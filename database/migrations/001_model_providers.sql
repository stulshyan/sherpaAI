-- Migration: 001_model_providers
-- Description: Create model providers and available models tables for E-003 Model Adapter Framework
-- Created: 2024-12-02

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: model_providers
-- Description: Available AI model providers (Anthropic, OpenAI, Google)
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    api_key_env_var VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active providers lookup
CREATE INDEX idx_model_providers_active ON model_providers(is_active, priority);

-- ============================================================================
-- Table: available_models
-- Description: AI models available from each provider with pricing
-- ============================================================================
CREATE TABLE IF NOT EXISTS available_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    input_price_per_million DECIMAL(10, 4) NOT NULL,
    output_price_per_million DECIMAL(10, 4) NOT NULL,
    capabilities JSONB DEFAULT '[]'::jsonb,
    tier VARCHAR(20) DEFAULT 'standard' CHECK (tier IN ('economy', 'standard', 'premium')),
    is_recommended BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider_id, model_id)
);

-- Indexes for model lookups
CREATE INDEX idx_available_models_provider ON available_models(provider_id, is_active);
CREATE INDEX idx_available_models_tier ON available_models(tier, is_active);
CREATE INDEX idx_available_models_recommended ON available_models(is_recommended, is_active);

-- ============================================================================
-- Table: model_fallback_chains
-- Description: Fallback chain configuration for model failover
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_fallback_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_model_id UUID NOT NULL REFERENCES available_models(id) ON DELETE CASCADE,
    fallback_model_id UUID NOT NULL REFERENCES available_models(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(primary_model_id, fallback_model_id)
);

-- Index for fallback lookups
CREATE INDEX idx_model_fallback_chains_primary ON model_fallback_chains(primary_model_id, is_active, priority);

-- ============================================================================
-- Table: model_usage_log
-- Description: Track usage and costs per model for billing and analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES available_models(id),
    agent_type VARCHAR(50) NOT NULL,
    execution_id UUID NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL,
    latency_ms INTEGER NOT NULL,
    is_fallback BOOLEAN DEFAULT false,
    fallback_reason VARCHAR(500),
    request_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics and billing queries
CREATE INDEX idx_model_usage_log_model ON model_usage_log(model_id, created_at);
CREATE INDEX idx_model_usage_log_agent ON model_usage_log(agent_type, created_at);
CREATE INDEX idx_model_usage_log_execution ON model_usage_log(execution_id);
CREATE INDEX idx_model_usage_log_date ON model_usage_log(created_at);

-- Partitioning for model_usage_log (optional, for high-volume deployments)
-- Uncomment if using partitioned tables
-- ALTER TABLE model_usage_log RENAME TO model_usage_log_old;
-- CREATE TABLE model_usage_log (LIKE model_usage_log_old INCLUDING ALL) PARTITION BY RANGE (created_at);
-- CREATE TABLE model_usage_log_2024_q4 PARTITION OF model_usage_log FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
-- CREATE TABLE model_usage_log_2025_q1 PARTITION OF model_usage_log FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

-- ============================================================================
-- Function: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_model_providers_updated_at
    BEFORE UPDATE ON model_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_available_models_updated_at
    BEFORE UPDATE ON available_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data: Insert default providers
-- ============================================================================
INSERT INTO model_providers (name, display_name, base_url, api_key_env_var, priority) VALUES
    ('anthropic', 'Anthropic', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY', 1),
    ('openai', 'OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY', 2),
    ('google', 'Google AI', 'https://generativelanguage.googleapis.com', 'GOOGLE_API_KEY', 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Seed Data: Insert default models
-- ============================================================================

-- Anthropic Models
WITH anthropic_provider AS (
    SELECT id FROM model_providers WHERE name = 'anthropic'
)
INSERT INTO available_models (
    provider_id, model_id, display_name, context_window, max_output_tokens,
    input_price_per_million, output_price_per_million, capabilities, tier, is_recommended
)
SELECT
    ap.id,
    m.model_id,
    m.display_name,
    m.context_window,
    m.max_output_tokens,
    m.input_price,
    m.output_price,
    m.capabilities::jsonb,
    m.tier,
    m.is_recommended
FROM anthropic_provider ap
CROSS JOIN (VALUES
    ('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5', 200000, 8192, 3.00, 15.00, '["text","json","tools","streaming"]', 'standard', true),
    ('claude-opus-4-5-20251101', 'Claude Opus 4.5', 200000, 8192, 15.00, 75.00, '["text","json","tools","streaming"]', 'premium', false),
    ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 200000, 8192, 3.00, 15.00, '["text","json","tools","streaming"]', 'standard', false),
    ('claude-3-opus-20240229', 'Claude 3 Opus', 200000, 4096, 15.00, 75.00, '["text","json","tools","streaming"]', 'premium', false),
    ('claude-3-haiku-20240307', 'Claude 3 Haiku', 200000, 4096, 0.25, 1.25, '["text","json","tools","streaming"]', 'economy', false)
) AS m(model_id, display_name, context_window, max_output_tokens, input_price, output_price, capabilities, tier, is_recommended)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- OpenAI Models
WITH openai_provider AS (
    SELECT id FROM model_providers WHERE name = 'openai'
)
INSERT INTO available_models (
    provider_id, model_id, display_name, context_window, max_output_tokens,
    input_price_per_million, output_price_per_million, capabilities, tier, is_recommended
)
SELECT
    op.id,
    m.model_id,
    m.display_name,
    m.context_window,
    m.max_output_tokens,
    m.input_price,
    m.output_price,
    m.capabilities::jsonb,
    m.tier,
    m.is_recommended
FROM openai_provider op
CROSS JOIN (VALUES
    ('gpt-4o', 'GPT-4o', 128000, 16384, 2.50, 10.00, '["text","json","tools","streaming","vision"]', 'standard', true),
    ('gpt-4o-mini', 'GPT-4o Mini', 128000, 16384, 0.15, 0.60, '["text","json","tools","streaming","vision"]', 'economy', false),
    ('gpt-4-turbo', 'GPT-4 Turbo', 128000, 4096, 10.00, 30.00, '["text","json","tools","streaming","vision"]', 'premium', false),
    ('gpt-4', 'GPT-4', 8192, 4096, 30.00, 60.00, '["text","json","tools","streaming"]', 'premium', false),
    ('gpt-3.5-turbo', 'GPT-3.5 Turbo', 16385, 4096, 0.50, 1.50, '["text","json","tools","streaming"]', 'economy', false)
) AS m(model_id, display_name, context_window, max_output_tokens, input_price, output_price, capabilities, tier, is_recommended)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Google Models
WITH google_provider AS (
    SELECT id FROM model_providers WHERE name = 'google'
)
INSERT INTO available_models (
    provider_id, model_id, display_name, context_window, max_output_tokens,
    input_price_per_million, output_price_per_million, capabilities, tier, is_recommended
)
SELECT
    gp.id,
    m.model_id,
    m.display_name,
    m.context_window,
    m.max_output_tokens,
    m.input_price,
    m.output_price,
    m.capabilities::jsonb,
    m.tier,
    m.is_recommended
FROM google_provider gp
CROSS JOIN (VALUES
    ('gemini-1.5-pro', 'Gemini 1.5 Pro', 2097152, 8192, 1.25, 5.00, '["text","json","tools","streaming","vision"]', 'standard', true),
    ('gemini-1.5-flash', 'Gemini 1.5 Flash', 1048576, 8192, 0.075, 0.30, '["text","json","tools","streaming","vision"]', 'economy', false),
    ('gemini-1.0-pro', 'Gemini 1.0 Pro', 32768, 8192, 0.50, 1.50, '["text","json","streaming"]', 'standard', false)
) AS m(model_id, display_name, context_window, max_output_tokens, input_price, output_price, capabilities, tier, is_recommended)
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- Seed Data: Insert default fallback chains
-- ============================================================================
WITH models AS (
    SELECT am.id, am.model_id
    FROM available_models am
    JOIN model_providers mp ON am.provider_id = mp.id
)
INSERT INTO model_fallback_chains (primary_model_id, fallback_model_id, priority)
SELECT
    primary_m.id,
    fallback_m.id,
    fc.priority
FROM (VALUES
    ('claude-sonnet-4-5-20250929', 'gpt-4o', 1),
    ('claude-sonnet-4-5-20250929', 'gemini-1.5-pro', 2),
    ('claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 1),
    ('claude-opus-4-5-20251101', 'gpt-4o', 2),
    ('gpt-4o', 'claude-sonnet-4-5-20250929', 1),
    ('gpt-4o', 'gemini-1.5-pro', 2),
    ('gemini-1.5-pro', 'claude-sonnet-4-5-20250929', 1),
    ('gemini-1.5-pro', 'gpt-4o', 2)
) AS fc(primary_model, fallback_model, priority)
JOIN models primary_m ON primary_m.model_id = fc.primary_model
JOIN models fallback_m ON fallback_m.model_id = fc.fallback_model
ON CONFLICT (primary_model_id, fallback_model_id) DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE model_providers IS 'AI model providers like Anthropic, OpenAI, Google';
COMMENT ON TABLE available_models IS 'Available AI models with pricing and capabilities';
COMMENT ON TABLE model_fallback_chains IS 'Fallback chain configuration for model failover';
COMMENT ON TABLE model_usage_log IS 'Usage and cost tracking per model request';

COMMENT ON COLUMN available_models.capabilities IS 'JSON array of capabilities: text, json, tools, streaming, vision';
COMMENT ON COLUMN available_models.tier IS 'Pricing tier: economy, standard, premium';
COMMENT ON COLUMN model_usage_log.is_fallback IS 'True if this was a fallback request after primary failed';
