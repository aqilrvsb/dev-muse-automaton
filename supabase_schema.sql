-- ================================================
-- CHATBOT AUTOMATION PLATFORM - DATABASE SCHEMA
-- ================================================
-- Version: 2.0 (Rebuilt from scratch)
-- Date: 2025-10-21
-- Description: Complete database schema for Supabase
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE: users
-- Purpose: User accounts and authentication
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABLE: device_setting
-- Purpose: WhatsApp device configurations
-- ================================================
CREATE TABLE IF NOT EXISTS device_setting (
    device_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('wablas', 'whacenter', 'waha')),
    api_key TEXT,
    auth_header TEXT,
    webhook_url TEXT,
    base_url TEXT,
    status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'disconnected')),
    device_name TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_setting_user_id ON device_setting(user_id);

-- ================================================
-- TABLE: chatbot_flows
-- Purpose: Visual flow definitions (nodes and edges)
-- ================================================
CREATE TABLE IF NOT EXISTS chatbot_flows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    device_id TEXT REFERENCES device_setting(device_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    flow_name TEXT NOT NULL,
    flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_flows_device_id ON chatbot_flows(device_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_user_id ON chatbot_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_is_active ON chatbot_flows(is_active);

-- ================================================
-- TABLE: ai_whatsapp
-- Purpose: Conversation tracking and history
-- ================================================
CREATE TABLE IF NOT EXISTS ai_whatsapp (
    id_prospect SERIAL PRIMARY KEY,
    prospect_num TEXT NOT NULL,
    id_device TEXT NOT NULL,
    name TEXT,
    stage TEXT DEFAULT 'new',
    niche TEXT,
    conversation_history JSONB DEFAULT '[]',
    ai_context TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    flow_node_id TEXT,
    flow_tracking JSONB DEFAULT '{}',
    session_locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(prospect_num, id_device)
);

CREATE INDEX IF NOT EXISTS idx_ai_whatsapp_prospect_device ON ai_whatsapp(prospect_num, id_device);
CREATE INDEX IF NOT EXISTS idx_ai_whatsapp_device ON ai_whatsapp(id_device);
CREATE INDEX IF NOT EXISTS idx_ai_whatsapp_stage ON ai_whatsapp(stage);
CREATE INDEX IF NOT EXISTS idx_ai_whatsapp_last_message ON ai_whatsapp(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_whatsapp_session_lock ON ai_whatsapp(session_locked_until);

-- ================================================
-- TABLE: conversation_log
-- Purpose: Message history logs
-- ================================================
CREATE TABLE IF NOT EXISTS conversation_log (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    prospect_num TEXT NOT NULL,
    message TEXT,
    sender TEXT CHECK (sender IN ('user', 'bot')),
    media_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_log_device_prospect ON conversation_log(device_id, prospect_num);
CREATE INDEX IF NOT EXISTS idx_conversation_log_timestamp ON conversation_log(timestamp DESC);

-- ================================================
-- TABLE: ai_settings
-- Purpose: AI model configurations
-- ================================================
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT DEFAULT 'openrouter' CHECK (provider IN ('openai', 'openrouter', 'anthropic')),
    model TEXT DEFAULT 'openai/gpt-3.5-turbo',
    api_key TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 1000,
    system_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABLE: orders
-- Purpose: Payment/billing records
-- ================================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'MYR',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_provider TEXT,
    payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ================================================
-- TABLE: execution_process
-- Purpose: Flow execution tracking
-- ================================================
CREATE TABLE IF NOT EXISTS execution_process (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    flow_id TEXT,
    prospect_num TEXT,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    current_node_id TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_execution_process_device ON execution_process(device_id);
CREATE INDEX IF NOT EXISTS idx_execution_process_status ON execution_process(status);

-- ================================================
-- TABLE: stage_set_value
-- Purpose: Stage-based configurations
-- ================================================
CREATE TABLE IF NOT EXISTS stage_set_value (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    value JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, stage_name)
);

-- ================================================
-- FUNCTIONS: Auto-update timestamps
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_setting_updated_at BEFORE UPDATE ON device_setting
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chatbot_flows_updated_at BEFORE UPDATE ON chatbot_flows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_whatsapp_updated_at BEFORE UPDATE ON ai_whatsapp
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stage_set_value_updated_at BEFORE UPDATE ON stage_set_value
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_set_value ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own devices" ON device_setting
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own flows" ON chatbot_flows
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI settings" ON ai_settings
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders
    FOR ALL USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access ai_whatsapp" ON ai_whatsapp
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access conversation_log" ON conversation_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access execution_process" ON execution_process
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access stage_set_value" ON stage_set_value
    FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- SAMPLE DATA (for testing)
-- ================================================
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'test@chatbot-automation.com',
    '$2a$10$8K1p/a0dL3gBt5KeGvXnVe6VfJZWG4qV0QnLfJZQXBqWGzqJvYXGy',
    'Test User'
) ON CONFLICT (email) DO NOTHING;
