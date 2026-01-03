-- Remove Session Tables
-- These tables are no longer used in the current system

-- The system now tracks conversation state directly in the ai_whatsapp table:
-- - stage: Current conversation stage
-- - conv_last: Previous conversation
-- - conv_current: Current conversation
-- - human: Flag to indicate if human takeover (0 = AI, 1 = Human)

-- Drop ai_whatsapp_session table if exists
DROP TABLE IF EXISTS ai_whatsapp_session CASCADE;

-- Drop wasapBot_session table if exists
DROP TABLE IF EXISTS wasapBot_session CASCADE;

-- Drop any related indexes
DROP INDEX IF EXISTS idx_ai_whatsapp_session_device_id;
DROP INDEX IF EXISTS idx_ai_whatsapp_session_phone;
DROP INDEX IF EXISTS idx_wasapbot_session_device_id;
DROP INDEX IF EXISTS idx_wasapbot_session_phone;

-- Note: The ai_whatsapp table now handles all conversation state management
