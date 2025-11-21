-- Migration script to update ai_whatsapp table schema
-- This will transform the old schema to the new simplified schema

-- First, let's add the new columns if they don't exist
ALTER TABLE ai_whatsapp
  ADD COLUMN IF NOT EXISTS date_insert DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS detail TEXT;

-- Rename id_device to device_id if the old column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_whatsapp' AND column_name = 'id_device'
  ) THEN
    ALTER TABLE ai_whatsapp RENAME COLUMN id_device TO device_id;
  END IF;
END $$;

-- Drop columns that are no longer needed
ALTER TABLE ai_whatsapp
  DROP COLUMN IF EXISTS keywordiklan,
  DROP COLUMN IF EXISTS marketer,
  DROP COLUMN IF EXISTS balas,
  DROP COLUMN IF EXISTS waiting_for_reply,
  DROP COLUMN IF EXISTS last_node_id,
  DROP COLUMN IF EXISTS current_node_id,
  DROP COLUMN IF EXISTS flow_id,
  DROP COLUMN IF EXISTS execution_status,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- Drop old indexes that reference removed columns
DROP INDEX IF EXISTS ai_whatsapp_execution_status_idx;
DROP INDEX IF EXISTS ai_whatsapp_waiting_for_reply_idx;
DROP INDEX IF EXISTS ai_whatsapp_flow_id_idx;
DROP INDEX IF EXISTS ai_whatsapp_current_node_id_idx;
DROP INDEX IF EXISTS ai_whatsapp_created_at_idx;

-- Drop the old id_device index and create new device_id index
DROP INDEX IF EXISTS ai_whatsapp_id_device_idx;
CREATE INDEX IF NOT EXISTS ai_whatsapp_device_id_idx ON ai_whatsapp(device_id);

-- Keep these existing indexes (they're still relevant)
-- ai_whatsapp_prospect_num_idx
-- ai_whatsapp_stage_idx
-- ai_whatsapp_human_idx
-- ai_whatsapp_niche_idx

-- Add new indexes for the new columns
CREATE INDEX IF NOT EXISTS ai_whatsapp_user_id_idx ON ai_whatsapp(user_id);
CREATE INDEX IF NOT EXISTS ai_whatsapp_date_insert_idx ON ai_whatsapp(date_insert);

-- Drop the execution_status check constraint
ALTER TABLE ai_whatsapp
  DROP CONSTRAINT IF EXISTS ai_whatsapp_execution_status_check;

-- Drop the updated_at trigger since we're removing that column
DROP TRIGGER IF EXISTS update_ai_whatsapp_updated_at ON ai_whatsapp;

-- Enable Row Level Security
ALTER TABLE ai_whatsapp ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user isolation
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own ai_whatsapp" ON ai_whatsapp;
DROP POLICY IF EXISTS "Users can insert own ai_whatsapp" ON ai_whatsapp;
DROP POLICY IF EXISTS "Users can update own ai_whatsapp" ON ai_whatsapp;
DROP POLICY IF EXISTS "Users can delete own ai_whatsapp" ON ai_whatsapp;

-- Create new policies
CREATE POLICY "Users can view own ai_whatsapp"
  ON ai_whatsapp FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_whatsapp"
  ON ai_whatsapp FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_whatsapp"
  ON ai_whatsapp FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai_whatsapp"
  ON ai_whatsapp FOR DELETE
  USING (auth.uid() = user_id);

-- Final schema after migration:
-- id_prospect (serial, PK)
-- device_id (varchar 255)
-- prospect_name (varchar 225)
-- prospect_num (varchar 255, unique)
-- niche (varchar 255)
-- intro (varchar 255)
-- stage (varchar 255)
-- conv_last (text)
-- conv_current (text)
-- human (integer, default 0)
-- date_insert (date, default CURRENT_DATE)
-- user_id (uuid, FK to "user"(id))
-- detail (text)
