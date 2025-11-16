-- ================================================
-- CHATBOT AUTOMATION PLATFORM - DATABASE SCHEMA
-- ================================================
-- Version: 2.0 Postgres-optimized
-- Date: 2025-10-21
-- ================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Clean slate (drops only the tables you declared)
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS stageSetValue CASCADE;
DROP TABLE IF EXISTS wasapBot_session CASCADE;
DROP TABLE IF EXISTS ai_whatsapp_session CASCADE;
DROP TABLE IF EXISTS wasapBot CASCADE;
DROP TABLE IF EXISTS ai_whatsapp CASCADE;
DROP TABLE IF EXISTS chatbot_flows CASCADE;
DROP TABLE IF EXISTS device_setting CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- ================================================
-- TABLE: user
-- ================================================
CREATE TABLE "user" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email citext NOT NULL UNIQUE,
  full_name varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  gmail varchar(255),
  phone varchar(20),
  status varchar(255) DEFAULT 'Trial',
  expired varchar(255),
  is_active boolean DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

-- Explicit email index is redundant because of UNIQUE, but keep a named one if desired
CREATE INDEX IF NOT EXISTS user_email_idx ON "user"(email);

-- ================================================
-- TABLE: user_sessions
-- ================================================
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  token varchar(255) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON user_sessions(token);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);

-- ================================================
-- TABLE: device_setting
-- ================================================
CREATE TABLE device_setting (
  id varchar(255) PRIMARY KEY,
  device_id varchar(255),
  instance text,
  webhook_id varchar(500),
  provider varchar(20) DEFAULT 'waha' CHECK (provider IN ('whacenter','wablas','waha')),
  api_key_option varchar(100) DEFAULT 'openai/gpt-4.1' CHECK (api_key_option IN (
    'openai/gpt-5-chat',
    'openai/gpt-5-mini',
    'openai/chatgpt-4o-latest',
    'openai/gpt-4.1',
    'google/gemini-2.5-pro',
    'google/gemini-pro-1.5'
  )),
  api_key text,
  id_device varchar(255),
  id_erp varchar(255),
  id_admin varchar(255),
  phone_number varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  CONSTRAINT fk_device_setting_user
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS device_setting_device_id_idx ON device_setting(device_id);
CREATE INDEX IF NOT EXISTS device_setting_provider_idx ON device_setting(provider);
-- RLS support: users manage own devices (by user_id)
CREATE INDEX IF NOT EXISTS device_setting_user_id_idx ON device_setting(user_id);
-- If id_device acts as unique business key, consider UNIQUE(id_device)
-- CREATE UNIQUE INDEX IF NOT EXISTS device_setting_id_device_uidx ON device_setting(id_device);

-- ================================================
-- TABLE: chatbot_flows
-- ================================================
CREATE TABLE chatbot_flows (
  id varchar(255) PRIMARY KEY,
  id_device varchar(255) NOT NULL DEFAULT '',
  name varchar(255) NOT NULL,
  niche varchar(255) NOT NULL DEFAULT '',
  nodes jsonb,
  edges jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_flows_id_device_idx ON chatbot_flows(id_device);

-- Optional: if device_setting.id_device is unique, enforce FK
-- ALTER TABLE chatbot_flows
--   ADD CONSTRAINT fk_chatbot_flows_device
--   FOREIGN KEY (id_device) REFERENCES device_setting(id_device) ON DELETE CASCADE;

-- ================================================
-- TABLE: ai_whatsapp
-- ================================================
CREATE TABLE ai_whatsapp (
  id_prospect serial PRIMARY KEY,
  flow_reference varchar(255),
  execution_id varchar(255),
  date_order timestamptz,
  id_device varchar(255),
  niche varchar(255),
  prospect_name varchar(225),
  prospect_num varchar(255) UNIQUE,
  intro varchar(255),
  stage varchar(255),
  conv_last text,
  conv_current text,
  execution_status varchar(20) CHECK (execution_status IN ('active','completed','failed')),
  flow_id varchar(255),
  current_node_id varchar(255),
  last_node_id varchar(255),
  waiting_for_reply boolean DEFAULT FALSE,
  balas varchar(255),
  human integer DEFAULT 0,
  keywordiklan varchar(255),
  marketer varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  update_today timestamptz
);

CREATE INDEX IF NOT EXISTS ai_whatsapp_prospect_num_idx ON ai_whatsapp(prospect_num);
CREATE INDEX IF NOT EXISTS ai_whatsapp_id_device_idx ON ai_whatsapp(id_device);
CREATE INDEX IF NOT EXISTS ai_whatsapp_stage_idx ON ai_whatsapp(stage);
CREATE INDEX IF NOT EXISTS ai_whatsapp_human_idx ON ai_whatsapp(human);
CREATE INDEX IF NOT EXISTS ai_whatsapp_niche_idx ON ai_whatsapp(niche);
CREATE INDEX IF NOT EXISTS ai_whatsapp_created_at_idx ON ai_whatsapp(created_at);
CREATE INDEX IF NOT EXISTS ai_whatsapp_execution_status_idx ON ai_whatsapp(execution_status);
CREATE INDEX IF NOT EXISTS ai_whatsapp_execution_id_idx ON ai_whatsapp(execution_id);
CREATE INDEX IF NOT EXISTS ai_whatsapp_flow_reference_idx ON ai_whatsapp(flow_reference);
CREATE INDEX IF NOT EXISTS ai_whatsapp_waiting_for_reply_idx ON ai_whatsapp(waiting_for_reply);
CREATE INDEX IF NOT EXISTS ai_whatsapp_flow_id_idx ON ai_whatsapp(flow_id);
CREATE INDEX IF NOT EXISTS ai_whatsapp_current_node_id_idx ON ai_whatsapp(current_node_id);

-- ================================================
-- TABLE: ai_whatsapp_session
-- ================================================
CREATE TABLE ai_whatsapp_session (
  id_sessionX serial PRIMARY KEY,
  id_prospect varchar(255) NOT NULL,
  id_device varchar(255) NOT NULL,
  "timestamp" varchar(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_whatsapp_session_prospect_idx ON ai_whatsapp_session(id_prospect);
CREATE INDEX IF NOT EXISTS ai_whatsapp_session_device_idx ON ai_whatsapp_session(id_device);

-- ================================================
-- TABLE: wasapBot
-- ================================================
CREATE TABLE wasapBot (
  id_prospect serial PRIMARY KEY,
  flow_reference varchar(255),
  execution_id varchar(255),
  execution_status varchar(20) CHECK (execution_status IN ('active','completed','failed')),
  flow_id varchar(255),
  current_node_id varchar(255),
  last_node_id varchar(255),
  waiting_for_reply boolean DEFAULT FALSE,
  id_device varchar(100),
  prospect_num varchar(100),
  niche varchar(300),
  peringkat_sekolah varchar(100),
  alamat varchar(100),
  nama varchar(100),
  pakej varchar(100),
  no_fon varchar(20),
  cara_bayaran varchar(100),
  tarikh_gaji varchar(20),
  stage varchar(200),
  temp_stage varchar(200),
  conv_start varchar(200),
  conv_last text,
  date_start varchar(50),
  date_last varchar(50),
  status varchar(200) DEFAULT 'Prospek'
);

CREATE INDEX IF NOT EXISTS wasapbot_prospect_num_idx ON wasapBot(prospect_num);
CREATE INDEX IF NOT EXISTS wasapbot_id_device_idx ON wasapBot(id_device);
CREATE INDEX IF NOT EXISTS wasapbot_stage_idx ON wasapBot(stage);

-- ================================================
-- TABLE: wasapBot_session
-- ================================================
CREATE TABLE wasapBot_session (
  id_sessionY serial PRIMARY KEY,
  id_prospect varchar(255) NOT NULL,
  id_device varchar(255) NOT NULL,
  "timestamp" varchar(255) NOT NULL,
  UNIQUE(id_prospect, id_device)
);

CREATE INDEX IF NOT EXISTS wasapbot_session_device_idx ON wasapBot_session(id_device);

-- ================================================
-- TABLE: stageSetValue
-- ================================================
CREATE TABLE stageSetValue (
  stageSetValue_id serial PRIMARY KEY,
  id_device varchar(255),
  stage varchar(255),
  type_inputData varchar(255),
  columnsData varchar(255),
  inputHardCode varchar(255)
);

CREATE INDEX IF NOT EXISTS stagesetvalue_device_idx ON stageSetValue(id_device);

-- ================================================
-- TABLE: orders
-- ================================================
CREATE TABLE orders (
  id serial PRIMARY KEY,
  user_id uuid,
  collection_id varchar(255),
  bill_id varchar(255),
  product varchar(255) NOT NULL,
  method varchar(20) DEFAULT 'billplz' CHECK (method IN ('billplz','cod')),
  amount numeric(10,2) NOT NULL,
  status varchar(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Processing','Success','Failed')),
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS orders_bill_id_idx ON orders(bill_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);

-- ================================================
-- FUNCTIONS: update_updated_at_column
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON "user"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_setting_updated_at
BEFORE UPDATE ON device_setting
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chatbot_flows_updated_at
BEFORE UPDATE ON chatbot_flows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_whatsapp_updated_at
BEFORE UPDATE ON ai_whatsapp
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- User policies (use SELECT wrappers for plan stability)
CREATE POLICY "Users can view own profile" ON "user"
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON "user"
  FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can manage own sessions" ON user_sessions
  FOR ALL USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can manage own devices" ON device_setting
  FOR ALL USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can manage own flows" ON chatbot_flows
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM device_setting ds
      WHERE ds.id_device = chatbot_flows.id_device
        AND ds.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can view own orders" ON orders
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- Conversation tables: enable RLS and service-role bypass
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

-- Helpful indexes for RLS performance (already added above):
-- user(id) PK, device_setting(user_id), chatbot_flows(id_device), orders(user_id)

-- ================================================
-- SAMPLE DATA
-- ================================================
INSERT INTO "user" (id, email, full_name, password, status)
VALUES (
  uuid_generate_v4(),
  'test@chatbot-automation.com',
  'Test User',
  '$2a$10$8K1p/a0dL3gBt5KeGvXnVe6VfJZWG4qV0QnLfJZQXBqWGzqJvYXGy',
  'Trial'
)
ON CONFLICT (email) DO NOTHING;
