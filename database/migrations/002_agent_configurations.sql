-- Migration: 002_agent_configurations
-- Description: Create agent configuration tables for E-003 Model Adapter Framework
-- Dependencies: 001_model_providers
-- Created: 2024-12-02

-- ============================================================================
-- Table: agent_configurations
-- Description: Configuration for each agent type (hot-swappable model settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    primary_model_id UUID NOT NULL REFERENCES available_models(id),
    temperature DECIMAL(3, 2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 4096,
    timeout_ms INTEGER DEFAULT 60000,
    max_retries INTEGER DEFAULT 3,
    prompt_template_key VARCHAR(200),
    output_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(200)
);

-- Index for active configurations
CREATE INDEX idx_agent_configurations_active ON agent_configurations(is_active);
CREATE INDEX idx_agent_configurations_type ON agent_configurations(agent_type);

-- ============================================================================
-- Table: agent_fallback_overrides
-- Description: Override fallback chains for specific agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_fallback_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_config_id UUID NOT NULL REFERENCES agent_configurations(id) ON DELETE CASCADE,
    fallback_model_id UUID NOT NULL REFERENCES available_models(id),
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_config_id, fallback_model_id)
);

-- Index for fallback lookups
CREATE INDEX idx_agent_fallback_overrides_agent ON agent_fallback_overrides(agent_config_id, is_active, priority);

-- ============================================================================
-- Table: agent_configuration_history
-- Description: Track configuration changes for audit and rollback
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_configuration_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_config_id UUID NOT NULL REFERENCES agent_configurations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    previous_config JSONB NOT NULL,
    new_config JSONB NOT NULL,
    change_reason VARCHAR(500),
    changed_by VARCHAR(200),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX idx_agent_configuration_history_agent ON agent_configuration_history(agent_config_id, changed_at DESC);

-- ============================================================================
-- Table: agent_executions
-- Description: Track agent execution history with performance metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_config_id UUID NOT NULL REFERENCES agent_configurations(id),
    project_id UUID,
    feature_id UUID,
    requirement_id UUID,
    model_used VARCHAR(100) NOT NULL,
    model_id UUID REFERENCES available_models(id),
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL,
    latency_ms INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    error_code VARCHAR(50),
    is_fallback BOOLEAN DEFAULT false,
    fallback_depth INTEGER DEFAULT 0,
    quality_score DECIMAL(3, 2),
    request_metadata JSONB DEFAULT '{}'::jsonb,
    response_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for execution queries
CREATE INDEX idx_agent_executions_config ON agent_executions(agent_config_id, created_at DESC);
CREATE INDEX idx_agent_executions_feature ON agent_executions(feature_id, created_at DESC) WHERE feature_id IS NOT NULL;
CREATE INDEX idx_agent_executions_requirement ON agent_executions(requirement_id, created_at DESC) WHERE requirement_id IS NOT NULL;
CREATE INDEX idx_agent_executions_status ON agent_executions(status, created_at DESC);
CREATE INDEX idx_agent_executions_date ON agent_executions(created_at);

-- ============================================================================
-- Table: prompt_templates
-- Description: Store prompt templates with versioning (can be loaded from S3 too)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key VARCHAR(200) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    s3_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(200)
);

-- Index for template lookups
CREATE INDEX idx_prompt_templates_key ON prompt_templates(template_key, is_active);

-- ============================================================================
-- Function: Track configuration changes
-- ============================================================================
CREATE OR REPLACE FUNCTION track_agent_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO agent_configuration_history (
        agent_config_id,
        version,
        previous_config,
        new_config,
        changed_by
    ) VALUES (
        OLD.id,
        OLD.version,
        row_to_json(OLD)::jsonb,
        row_to_json(NEW)::jsonb,
        NEW.updated_by
    );

    NEW.version := OLD.version + 1;
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER track_agent_configuration_changes
    BEFORE UPDATE ON agent_configurations
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION track_agent_config_changes();

-- ============================================================================
-- Function: Update updated_at timestamp for prompt_templates
-- ============================================================================
CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data: Insert default agent configurations
-- ============================================================================

-- Get default model IDs
WITH claude_sonnet AS (
    SELECT am.id
    FROM available_models am
    JOIN model_providers mp ON am.provider_id = mp.id
    WHERE mp.name = 'anthropic' AND am.model_id = 'claude-sonnet-4-5-20250929'
),
claude_opus AS (
    SELECT am.id
    FROM available_models am
    JOIN model_providers mp ON am.provider_id = mp.id
    WHERE mp.name = 'anthropic' AND am.model_id = 'claude-opus-4-5-20251101'
)
INSERT INTO agent_configurations (
    agent_type, display_name, description, primary_model_id, temperature, max_tokens, timeout_ms, prompt_template_key
)
SELECT
    ac.agent_type,
    ac.display_name,
    ac.description,
    CASE WHEN ac.use_opus THEN opus.id ELSE sonnet.id END,
    ac.temperature,
    ac.max_tokens,
    ac.timeout_ms,
    ac.prompt_template_key
FROM claude_sonnet sonnet
CROSS JOIN claude_opus opus
CROSS JOIN (VALUES
    ('classifier', 'Requirement Classifier', 'Classifies requirement type and suggests decomposition strategy', false, 0.3, 2048, 30000, 'agents/classifier/system'),
    ('decomposer', 'Requirement Decomposer', 'Breaks down complex requirements into atomic features', false, 0.5, 8192, 120000, 'agents/decomposer/system'),
    ('impact_analyzer', 'Impact Analyzer', 'Analyzes feature impact on existing codebase', false, 0.4, 4096, 60000, 'agents/impact_analyzer/system'),
    ('spec_generator', 'Specification Generator', 'Generates detailed technical specifications', false, 0.4, 8192, 90000, 'agents/spec_generator/system'),
    ('code_generator', 'Code Generator', 'Generates implementation code from specifications', true, 0.2, 16384, 180000, 'agents/code_generator/system')
) AS ac(agent_type, display_name, description, use_opus, temperature, max_tokens, timeout_ms, prompt_template_key)
ON CONFLICT (agent_type) DO NOTHING;

-- ============================================================================
-- Seed Data: Insert fallback overrides for agents
-- ============================================================================
WITH agent_configs AS (
    SELECT id, agent_type FROM agent_configurations
),
models AS (
    SELECT am.id, am.model_id
    FROM available_models am
    JOIN model_providers mp ON am.provider_id = mp.id
)
INSERT INTO agent_fallback_overrides (agent_config_id, fallback_model_id, priority)
SELECT
    ac.id,
    m.id,
    fo.priority
FROM (VALUES
    -- Classifier fallbacks
    ('classifier', 'gpt-4o', 1),
    ('classifier', 'gemini-1.5-pro', 2),
    -- Decomposer fallbacks
    ('decomposer', 'gpt-4o', 1),
    ('decomposer', 'gemini-1.5-pro', 2),
    -- Impact Analyzer fallbacks
    ('impact_analyzer', 'gpt-4o', 1),
    ('impact_analyzer', 'gemini-1.5-pro', 2),
    -- Spec Generator fallbacks
    ('spec_generator', 'gpt-4o', 1),
    ('spec_generator', 'gemini-1.5-pro', 2),
    -- Code Generator fallbacks (prefers Claude)
    ('code_generator', 'claude-sonnet-4-5-20250929', 1),
    ('code_generator', 'gpt-4o', 2)
) AS fo(agent_type, model_id, priority)
JOIN agent_configs ac ON ac.agent_type = fo.agent_type
JOIN models m ON m.model_id = fo.model_id
ON CONFLICT (agent_config_id, fallback_model_id) DO NOTHING;

-- ============================================================================
-- Seed Data: Insert default prompt templates
-- ============================================================================
INSERT INTO prompt_templates (template_key, display_name, description, template_content, variables)
VALUES
    (
        'agents/classifier/system',
        'Classifier System Prompt',
        'System prompt for the requirement classifier agent',
        'You are an expert requirements analyst specializing in software development projects. Your task is to classify requirements and suggest decomposition strategies.

When classifying a requirement, consider:
1. Is it a new feature, enhancement, bug fix, or epic?
2. What is the complexity level?
3. What decomposition strategy would be most effective?

Respond in JSON format with the following structure:
{
  "type": "new_feature|enhancement|bug_fix|epic|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "suggestedDecomposition": {
    "strategy": "vertical|horizontal|functional",
    "estimatedFeatures": number
  }
}',
        '["requirementText"]'::jsonb
    ),
    (
        'agents/decomposer/system',
        'Decomposer System Prompt',
        'System prompt for the requirement decomposer agent',
        'You are an expert software architect specializing in breaking down complex requirements into atomic, implementable features.

When decomposing a requirement:
1. Identify distinct themes or capability areas
2. Break each theme into atomic features (single responsibility)
3. Define clear acceptance criteria for each feature
4. Identify dependencies between features
5. Flag any clarification questions

Respond in JSON format with atomic requirements, themes, and feature candidates.',
        '["requirementText", "requirementType", "context"]'::jsonb
    ),
    (
        'agents/impact_analyzer/system',
        'Impact Analyzer System Prompt',
        'System prompt for the impact analyzer agent',
        'You are a senior software engineer analyzing the impact of new features on an existing codebase.

Analyze:
1. Files and components that will need modification
2. Potential conflicts with existing functionality
3. Performance implications
4. Security considerations
5. Testing requirements

Provide detailed impact assessment with risk ratings.',
        '["featureSpec", "codebaseContext", "existingArchitecture"]'::jsonb
    ),
    (
        'agents/spec_generator/system',
        'Spec Generator System Prompt',
        'System prompt for the specification generator agent',
        'You are a technical writer and software architect creating detailed specifications from feature descriptions.

Generate specifications including:
1. Functional requirements
2. Technical design
3. API contracts
4. Data models
5. Error handling
6. Testing strategy

Produce clear, implementation-ready specifications.',
        '["featureDescription", "impactAnalysis", "constraints"]'::jsonb
    ),
    (
        'agents/code_generator/system',
        'Code Generator System Prompt',
        'System prompt for the code generator agent',
        'You are an expert software developer generating production-ready code from specifications.

Follow these principles:
1. Write clean, maintainable code
2. Follow project coding standards
3. Include comprehensive error handling
4. Add appropriate tests
5. Document complex logic
6. Consider edge cases

Generate implementation code that is ready for review.',
        '["specification", "techStack", "existingCode", "testRequirements"]'::jsonb
    )
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================================
-- View: Active agent configurations with model details
-- ============================================================================
CREATE OR REPLACE VIEW v_agent_configurations AS
SELECT
    ac.id,
    ac.agent_type,
    ac.display_name,
    ac.description,
    am.model_id AS primary_model,
    mp.name AS provider,
    ac.temperature,
    ac.max_tokens,
    ac.timeout_ms,
    ac.max_retries,
    ac.prompt_template_key,
    ac.version,
    ac.is_active,
    ac.updated_at
FROM agent_configurations ac
JOIN available_models am ON ac.primary_model_id = am.id
JOIN model_providers mp ON am.provider_id = mp.id
WHERE ac.is_active = true;

-- ============================================================================
-- View: Agent execution statistics
-- ============================================================================
CREATE OR REPLACE VIEW v_agent_execution_stats AS
SELECT
    ac.agent_type,
    COUNT(*) AS total_executions,
    COUNT(*) FILTER (WHERE ae.status = 'completed') AS successful,
    COUNT(*) FILTER (WHERE ae.status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE ae.is_fallback = true) AS fallback_used,
    ROUND(AVG(ae.latency_ms)::numeric, 2) AS avg_latency_ms,
    ROUND(AVG(ae.cost_usd)::numeric, 6) AS avg_cost_usd,
    ROUND(SUM(ae.cost_usd)::numeric, 4) AS total_cost_usd,
    SUM(ae.input_tokens) AS total_input_tokens,
    SUM(ae.output_tokens) AS total_output_tokens,
    ROUND(AVG(ae.quality_score)::numeric, 2) AS avg_quality_score
FROM agent_configurations ac
LEFT JOIN agent_executions ae ON ac.id = ae.agent_config_id
WHERE ae.created_at >= NOW() - INTERVAL '30 days'
GROUP BY ac.agent_type;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE agent_configurations IS 'Hot-swappable agent configurations with model assignments';
COMMENT ON TABLE agent_fallback_overrides IS 'Agent-specific fallback chain overrides';
COMMENT ON TABLE agent_configuration_history IS 'Audit trail for configuration changes';
COMMENT ON TABLE agent_executions IS 'Execution history with performance metrics';
COMMENT ON TABLE prompt_templates IS 'Versioned prompt templates for agents';

COMMENT ON VIEW v_agent_configurations IS 'Active agent configurations with model details';
COMMENT ON VIEW v_agent_execution_stats IS '30-day execution statistics per agent type';
