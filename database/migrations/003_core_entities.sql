-- Migration: 003_core_entities
-- Description: Create core entity tables for E-004 Database & Storage Layer
-- Dependencies: 001_model_providers, 002_agent_configurations
-- Created: 2024-12-03

-- ============================================================================
-- Table: clients
-- Description: Top-level tenant for multi-tenancy support
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200),
    tier VARCHAR(50) DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'enterprise')),
    s3_bucket_prefix VARCHAR(200) UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clients_active ON clients(is_active);

-- ============================================================================
-- Table: users
-- Description: User accounts for authentication & authorization
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(320) UNIQUE NOT NULL,
    name VARCHAR(200),
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'product_manager', 'developer', 'viewer')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- Table: projects
-- Description: Projects for organizing requirements and features
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    architecture_context JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    wip_limit INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================================================
-- Table: requirements
-- Description: Uploaded requirements for decomposition
-- ============================================================================
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source_type VARCHAR(50) CHECK (source_type IN ('document', 'api', 'manual')),
    source_file_s3_key VARCHAR(1000),
    extracted_text_s3_key VARCHAR(1000),
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    type VARCHAR(50) CHECK (type IN ('new_feature', 'enhancement', 'epic', 'bug_fix', 'unknown')),
    type_confidence DECIMAL(3, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'extracting', 'extracted', 'classifying', 'classified', 'decomposing', 'decomposed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_requirements_project ON requirements(project_id);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_created ON requirements(created_at DESC);

-- ============================================================================
-- Table: features
-- Description: Features extracted from requirements
-- ============================================================================
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_feature_id UUID REFERENCES features(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    feature_type VARCHAR(50) CHECK (feature_type IN ('new_feature', 'enhancement', 'bug_fix', 'epic', 'technical')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_clarification', 'ready', 'in_progress', 'completed', 'blocked', 'cancelled')),
    priority_score DECIMAL(5, 2) DEFAULT 0.0,
    readiness_score DECIMAL(5, 2) DEFAULT 0.0,
    complexity_score DECIMAL(5, 2),
    business_value DECIMAL(5, 2),
    urgency_score DECIMAL(5, 2),
    version INTEGER DEFAULT 1,
    current_loop VARCHAR(10) CHECK (current_loop IN ('loop_0', 'loop_a', 'loop_b', 'loop_c')),
    theme VARCHAR(200),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_features_requirement ON features(requirement_id);
CREATE INDEX idx_features_project ON features(project_id);
CREATE INDEX idx_features_parent ON features(parent_feature_id);
CREATE INDEX idx_features_status ON features(status);
CREATE INDEX idx_features_priority ON features(priority_score DESC);
CREATE INDEX idx_features_readiness ON features(readiness_score DESC);
CREATE INDEX idx_features_loop ON features(current_loop);

-- ============================================================================
-- Table: atomic_requirements
-- Description: Decomposed atomic requirements from features
-- ============================================================================
CREATE TABLE IF NOT EXISTS atomic_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    theme VARCHAR(200),
    clarity_score DECIMAL(5, 2),
    dependencies TEXT[] DEFAULT '{}',
    sequence_order INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_atomic_requirements_feature ON atomic_requirements(feature_id);
CREATE INDEX idx_atomic_requirements_theme ON atomic_requirements(theme);

-- ============================================================================
-- Table: feature_readiness
-- Description: Granular readiness tracking for features
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_readiness (
    feature_id UUID PRIMARY KEY REFERENCES features(id) ON DELETE CASCADE,
    business_clarity DECIMAL(5, 2) DEFAULT 0.0,
    technical_clarity DECIMAL(5, 2) DEFAULT 0.0,
    testability DECIMAL(5, 2) DEFAULT 0.0,
    ambiguity_score DECIMAL(5, 2) DEFAULT 1.0,
    blocking_questions JSONB DEFAULT '[]'::jsonb,
    clarification_answers JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Table: clarification_questions
-- Description: Questions requiring human input
-- ============================================================================
CREATE TABLE IF NOT EXISTS clarification_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple_choice', 'yes_no', 'text', 'dropdown')),
    options JSONB DEFAULT '[]'::jsonb,
    answer TEXT,
    answered_at TIMESTAMP WITH TIME ZONE,
    answered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(50) DEFAULT 'important' CHECK (priority IN ('blocking', 'important', 'nice_to_have')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clarification_questions_feature ON clarification_questions(feature_id);
CREATE INDEX idx_clarification_questions_unanswered ON clarification_questions(feature_id) WHERE answer IS NULL;
CREATE INDEX idx_clarification_questions_priority ON clarification_questions(priority);

-- ============================================================================
-- Table: feature_dependencies
-- Description: Dependency graph between features
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_dependencies (
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    depends_on_feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN ('blocks', 'related', 'parent')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (feature_id, depends_on_feature_id),
    CONSTRAINT no_self_dependency CHECK (feature_id != depends_on_feature_id)
);

CREATE INDEX idx_feature_dependencies_feature ON feature_dependencies(feature_id);
CREATE INDEX idx_feature_dependencies_depends_on ON feature_dependencies(depends_on_feature_id);

-- ============================================================================
-- Table: approvals
-- Description: Approval workflow for features in different loops
-- ============================================================================
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    loop_type VARCHAR(10) NOT NULL CHECK (loop_type IN ('loop_a', 'loop_b', 'loop_c')),
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
    comment TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approvals_feature ON approvals(feature_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- ============================================================================
-- Table: audit_log
-- Description: Complete audit trail for all entity changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(200),
    previous_state JSONB,
    new_state JSONB,
    change_details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================================================
-- Table: decomposition_results
-- Description: Stored decomposition outputs with S3 references
-- ============================================================================
CREATE TABLE IF NOT EXISTS decomposition_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    themes JSONB DEFAULT '[]'::jsonb,
    atomic_requirements JSONB DEFAULT '[]'::jsonb,
    feature_candidates JSONB DEFAULT '[]'::jsonb,
    clarification_questions JSONB DEFAULT '[]'::jsonb,
    output_s3_key VARCHAR(1000),
    processing_time_ms INTEGER,
    model_used VARCHAR(100),
    execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_decomposition_results_requirement ON decomposition_results(requirement_id);

-- ============================================================================
-- Update foreign key in agent_executions to reference new tables
-- ============================================================================
-- Add foreign key constraints (these columns already exist from migration 002)
ALTER TABLE agent_executions
    ADD CONSTRAINT fk_agent_executions_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_agent_executions_feature
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_agent_executions_requirement
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL;

-- ============================================================================
-- Apply updated_at triggers to new tables
-- ============================================================================
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at
    BEFORE UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_updated_at
    BEFORE UPDATE ON features
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Enable Row-Level Security (prepared for multi-tenancy)
-- ============================================================================
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE atomic_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View: Features with readiness details
CREATE OR REPLACE VIEW v_features_with_readiness AS
SELECT
    f.id,
    f.title,
    f.description,
    f.status,
    f.priority_score,
    f.readiness_score,
    f.theme,
    f.current_loop,
    f.project_id,
    f.requirement_id,
    fr.business_clarity,
    fr.technical_clarity,
    fr.testability,
    fr.ambiguity_score,
    f.created_at,
    f.updated_at,
    (
        SELECT COUNT(*)
        FROM clarification_questions cq
        WHERE cq.feature_id = f.id AND cq.answer IS NULL
    ) AS pending_questions_count
FROM features f
LEFT JOIN feature_readiness fr ON f.id = fr.feature_id;

-- View: Backlog summary by status
CREATE OR REPLACE VIEW v_backlog_summary AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    COUNT(*) FILTER (WHERE f.status = 'in_progress') AS in_progress_count,
    COUNT(*) FILTER (WHERE f.status = 'ready' AND f.readiness_score >= 0.7) AS ready_count,
    COUNT(*) FILTER (WHERE f.status = 'needs_clarification') AS needs_clarification_count,
    COUNT(*) FILTER (WHERE f.status = 'draft') AS draft_count,
    COUNT(*) FILTER (WHERE f.status = 'blocked') AS blocked_count,
    COUNT(*) AS total_count
FROM projects p
LEFT JOIN features f ON f.project_id = p.id
WHERE p.status = 'active'
GROUP BY p.id, p.name;

-- View: Recent audit log entries
CREATE OR REPLACE VIEW v_recent_audit AS
SELECT
    id,
    entity_type,
    entity_id,
    action,
    actor,
    change_details,
    created_at
FROM audit_log
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================================================
-- Seed Data: Create a default client and project for development
-- ============================================================================
INSERT INTO clients (id, name, company_name, tier, s3_bucket_prefix)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Client', 'Entropy Development', 'standard', 'default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, role, client_id)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'system@entropy.local', 'System', 'admin', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description, client_id)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Project', 'Default development project', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE clients IS 'Top-level tenant entities for multi-tenancy';
COMMENT ON TABLE users IS 'User accounts with role-based access control';
COMMENT ON TABLE projects IS 'Project containers for organizing requirements and features';
COMMENT ON TABLE requirements IS 'Uploaded requirements pending or completed decomposition';
COMMENT ON TABLE features IS 'Features extracted from requirements with priority and readiness tracking';
COMMENT ON TABLE atomic_requirements IS 'Atomic, implementable units extracted from features';
COMMENT ON TABLE feature_readiness IS 'Granular readiness metrics for features';
COMMENT ON TABLE clarification_questions IS 'Questions requiring human clarification';
COMMENT ON TABLE feature_dependencies IS 'Dependency graph between features';
COMMENT ON TABLE approvals IS 'Approval workflow for feature progression through loops';
COMMENT ON TABLE audit_log IS 'Complete audit trail for all entity changes';
COMMENT ON TABLE decomposition_results IS 'Cached decomposition outputs with S3 references';

COMMENT ON VIEW v_features_with_readiness IS 'Features with computed readiness metrics';
COMMENT ON VIEW v_backlog_summary IS 'Backlog statistics by project';
COMMENT ON VIEW v_recent_audit IS 'Recent audit log entries (last 7 days)';
