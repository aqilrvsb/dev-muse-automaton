-- ================================================
-- VERIFICATION QUERY
-- ================================================
-- Run this in Supabase SQL Editor to check if schema was executed
-- ================================================

-- Step 1: Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected output (10 tables):
-- ai_whatsapp
-- ai_whatsapp_session
-- chatbot_flows
-- device_setting
-- orders
-- stageSetValue
-- user
-- user_sessions
-- wasapBot
-- wasapBot_session

-- ================================================

-- Step 2: Check if user table has data
SELECT id, email, full_name, status, created_at
FROM "user"
LIMIT 5;

-- Expected output:
-- If schema executed: 1 row with test@chatbot-automation.com
-- If schema NOT executed: ERROR: relation "user" does not exist
-- If executed but no data: 0 rows

-- ================================================

-- Step 3: Check if extensions are enabled
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'citext');

-- Expected output:
-- uuid-ossp | 1.1
-- citext    | 1.6

-- ================================================

-- Step 4: Count all rows in user table
SELECT COUNT(*) as user_count FROM "user";

-- Expected: 1 (if test user was inserted)
