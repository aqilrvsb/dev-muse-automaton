-- ================================================
-- CHATBOT AUTOMATION PLATFORM - DATABASE SCHEMA V2
-- ================================================
-- Version: 2.0 (Updated with correct schema)
-- Date: 2025-10-21
-- Description: Complete database schema matching existing MySQL structure
-- ================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS wasapBot_session CASCADE;
DROP TABLE IF EXISTS ai_whatsapp_session CASCADE;
DROP TABLE IF EXISTS stageSetValue CASCADE;
DROP TABLE IF EXISTS wasapBot CASCADE;
DROP TABLE IF EXISTS ai_whatsapp CASCADE;
DROP TABLE IF EXISTS chatbot_flows CASCADE;
DROP TABLE IF EXISTS device_setting CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLE: user (user register data and profile)
-- ================================================
CREATE TABLE "user" (
    id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    gmail VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    status VARCHAR(255) DEFAULT 'Trial',
    expired VARCHAR(255) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT NULL
);

CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_status ON "user"(status);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABLE: user_sessions (logs of user session login)
-- ================================================
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id CHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_token ON user_sessions(token);
CREATE INDEX idx_user_id ON user_sessions(user_id);
CREATE INDEX idx_expires_at ON user_sessions(expires_at);

-- ================================================
-- TABLE: device_setting (user register device)
-- ================================================
CREATE TABLE device_setting (
    id VARCHAR(255) PRIMARY KEY,
    device_id VARCHAR(255) DEFAULT NULL,
    instance TEXT DEFAULT NULL,
    webhook_id VARCHAR(500) DEFAULT NULL,
    provider VARCHAR(20) DEFAULT 'waha' CHECK (provider IN ('whacenter', 'wablas', 'waha')),
    api_key_option VARCHAR(100) DEFAULT 'openai/gpt-4.1' CHECK (api_key_option IN (
        'openai/gpt-5-chat',
        'openai/gpt-5-mini',
        'openai/chatgpt-4o-latest',
        'openai/gpt-4.1',
        'google/gemini-2.5-pro',
        'google/gemini-pro-1.5'
    )),
    api_key TEXT DEFAULT NULL,
    id_device VARCHAR(255) DEFAULT NULL,
    id_erp VARCHAR(255) DEFAULT NULL,
    id_admin VARCHAR(255) DEFAULT NULL,
    phone_number VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id CHAR(36) DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_id ON device_setting(device_id);
CREATE INDEX idx_provider ON device_setting(provider);
CREATE INDEX idx_device_user_id ON device_setting(user_id);

CREATE TRIGGER update_device_setting_updated_at BEFORE UPDATE ON device_setting
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABLE: chatbot_flows (user created flow nodes)
-- ================================================
CREATE TABLE chatbot_flows (
    id VARCHAR(255) PRIMARY KEY,
    id_device VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL,
    niche VARCHAR(255) NOT NULL DEFAULT '',
    nodes JSONB DEFAULT NULL,
    edges JSONB DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flows_id_device ON chatbot_flows(id_device);
CREATE INDEX idx_flows_niche ON chatbot_flows(niche);

CREATE TRIGGER update_chatbot_flows_updated_at BEFORE UPDATE ON chatbot_flows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABLE: ai_whatsapp (user save data incoming message - Chatbot AI)
-- ================================================
CREATE TABLE ai_whatsapp (
    id_prospect SERIAL PRIMARY KEY,
    flow_reference VARCHAR(255) DEFAULT NULL,
    execution_id VARCHAR(255) DEFAULT NULL,
    date_order TIMESTAMP DEFAULT NULL,
    id_device VARCHAR(255) DEFAULT NULL,
    niche VARCHAR(255) DEFAULT NULL,
    prospect_name VARCHAR(225) DEFAULT NULL,
    prospect_num VARCHAR(255) DEFAULT NULL UNIQUE,
    intro VARCHAR(255) DEFAULT NULL,
    stage VARCHAR(255) DEFAULT NULL,
    conv_last TEXT DEFAULT NULL,
    conv_current TEXT DEFAULT NULL,
    execution_status VARCHAR(20) DEFAULT NULL CHECK (execution_status IN ('active', 'completed', 'failed')),
    flow_id VARCHAR(255) DEFAULT NULL,
    current_node_id VARCHAR(255) DEFAULT NULL,
    last_node_id VARCHAR(255) DEFAULT NULL,
    waiting_for_reply BOOLEAN DEFAULT FALSE,
    balas VARCHAR(255) DEFAULT NULL,
    human INTEGER DEFAULT 0,
    keywordiklan VARCHAR(255) DEFAULT NULL,
    marketer VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_today TIMESTAMP DEFAULT NULL
);

CREATE INDEX idx_prospect_num ON ai_whatsapp(prospect_num);
CREATE INDEX idx_id_staff ON ai_whatsapp(id_device);
CREATE INDEX idx_stage ON ai_whatsapp(stage);
CREATE INDEX idx_human ON ai_whatsapp(human);
CREATE INDEX idx_niche ON ai_whatsapp(niche);
CREATE INDEX idx_created_at ON ai_whatsapp(created_at);
CREATE INDEX idx_ai_whatsapp_execution_status ON ai_whatsapp(execution_status);
CREATE INDEX idx_ai_whatsapp_execution_id ON ai_whatsapp(execution_id);
CREATE INDEX idx_ai_whatsapp_flow_reference ON ai_whatsapp(flow_reference);
CREATE INDEX idx_waiting_for_reply ON ai_whatsapp(waiting_for_reply);
CREATE INDEX idx_flow_id ON ai_whatsapp(flow_id);
CREATE INDEX idx_current_node_id ON ai_whatsapp(current_node_id);

CREATE TRIGGER update_ai_whatsapp_updated_at BEFORE UPDATE ON ai_whatsapp
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABLE: ai_whatsapp_session (user lockout session for chatbot ai process)
-- ================================================
CREATE TABLE ai_whatsapp_session (
    id_sessionX SERIAL PRIMARY KEY,
    id_prospect VARCHAR(255) NOT NULL,
    id_device VARCHAR(255) NOT NULL,
    timestamp VARCHAR(255) NOT NULL,
    UNIQUE(id_prospect, id_device)
);

CREATE INDEX idx_ai_session_prospect ON ai_whatsapp_session(id_prospect);
CREATE INDEX idx_ai_session_device ON ai_whatsapp_session(id_device);

-- ================================================
-- TABLE: wasapBot (user save data incoming message - WasapBot Exama)
-- ================================================
CREATE TABLE wasapBot (
    id_prospect SERIAL PRIMARY KEY,
    flow_reference VARCHAR(255) DEFAULT NULL,
    execution_id VARCHAR(255) DEFAULT NULL,
    execution_status VARCHAR(20) DEFAULT NULL CHECK (execution_status IN ('active', 'completed', 'failed')),
    flow_id VARCHAR(255) DEFAULT NULL,
    current_node_id VARCHAR(255) DEFAULT NULL,
    last_node_id VARCHAR(255) DEFAULT NULL,
    waiting_for_reply BOOLEAN DEFAULT FALSE,
    id_device VARCHAR(100) DEFAULT NULL,
    prospect_num VARCHAR(100) DEFAULT NULL,
    niche VARCHAR(300) DEFAULT NULL,
    peringkat_sekolah VARCHAR(100) DEFAULT NULL,
    alamat VARCHAR(100) DEFAULT NULL,
    nama VARCHAR(100) DEFAULT NULL,
    pakej VARCHAR(100) DEFAULT NULL,
    no_fon VARCHAR(20) DEFAULT NULL,
    cara_bayaran VARCHAR(100) DEFAULT NULL,
    tarikh_gaji VARCHAR(20) DEFAULT NULL,
    stage VARCHAR(200) DEFAULT NULL,
    temp_stage VARCHAR(200) DEFAULT NULL,
    conv_start VARCHAR(200) DEFAULT NULL,
    conv_last TEXT DEFAULT NULL,
    date_start VARCHAR(50) DEFAULT NULL,
    date_last VARCHAR(50) DEFAULT NULL,
    status VARCHAR(200) DEFAULT 'Prospek'
);

CREATE INDEX idx_wasapbot_prospect_num ON wasapBot(prospect_num);
CREATE INDEX idx_wasapbot_id_device ON wasapBot(id_device);
CREATE INDEX idx_wasapbot_stage ON wasapBot(stage);
CREATE INDEX idx_wasapbot_execution_status ON wasapBot(execution_status);
CREATE INDEX idx_wasapbot_waiting_for_reply ON wasapBot(waiting_for_reply);

-- ================================================
-- TABLE: wasapBot_session (user lockout session for WasapBot Process)
-- ================================================
CREATE TABLE wasapBot_session (
    id_sessionY SERIAL PRIMARY KEY,
    id_prospect VARCHAR(255) NOT NULL,
    id_device VARCHAR(255) NOT NULL,
    timestamp VARCHAR(255) NOT NULL,
    UNIQUE(id_prospect, id_device)
);

CREATE INDEX idx_wasapbot_session_device ON wasapBot_session(id_device);

-- ================================================
-- TABLE: stageSetValue (user set the stage for WasapBot Exama)
-- ================================================
CREATE TABLE stageSetValue (
    stageSetValue_id SERIAL PRIMARY KEY,
    id_device VARCHAR(255) DEFAULT NULL,
    stage VARCHAR(255) DEFAULT NULL,
    type_inputData VARCHAR(255) DEFAULT NULL,
    columnsData VARCHAR(255) DEFAULT NULL,
    inputHardCode VARCHAR(255) DEFAULT NULL
);

CREATE INDEX idx_stage_set_device ON stageSetValue(id_device);
CREATE INDEX idx_stage_set_stage ON stageSetValue(stage);

-- ================================================
-- SAMPLE DATA (for testing)
-- ================================================
-- Insert test user
INSERT INTO "user" (id, email, full_name, password, status)
VALUES (
    uuid_generate_v4()::TEXT,
    'test@chatbot-automation.com',
    'Test User',
    '$2a$10$8K1p/a0dL3gBt5KeGvXnVe6VfJZWG4qV0QnLfJZQXBqWGzqJvYXGy',
    'Trial'
) ON CONFLICT (email) DO NOTHING;

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
-- Enable RLS on user tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON "user"
    FOR SELECT USING (auth.uid()::TEXT = id);

CREATE POLICY "Users can update own profile" ON "user"
    FOR UPDATE USING (auth.uid()::TEXT = id);

CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own devices" ON device_setting
    FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own flows" ON chatbot_flows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM device_setting
            WHERE device_setting.id_device = chatbot_flows.id_device
            AND device_setting.user_id = auth.uid()::TEXT
        )
    );

-- Service role has full access to conversation tables
ALTER TABLE ai_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_whatsapp_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE wasapBot ENABLE ROW LEVEL SECURITY;
ALTER TABLE wasapBot_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE stageSetValue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ai_whatsapp" ON ai_whatsapp
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access ai_whatsapp_session" ON ai_whatsapp_session
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access wasapBot" ON wasapBot
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access wasapBot_session" ON wasapBot_session
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access stageSetValue" ON stageSetValue
    FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- VERIFICATION
-- ================================================
-- Run this after executing to verify:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- ================================================
