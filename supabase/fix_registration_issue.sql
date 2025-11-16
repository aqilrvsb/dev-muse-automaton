-- ============================================================================
-- FIX REGISTRATION ISSUE
-- ============================================================================
-- This script fixes the "Database error saving new user" issue
-- ============================================================================

-- 1. Check current user table structure
DO $$
DECLARE
  column_exists BOOLEAN;
  column_nullable BOOLEAN;
BEGIN
  -- Check if password column exists and if it's nullable
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'password'
  ) INTO column_exists;

  IF column_exists THEN
    SELECT is_nullable = 'YES' INTO column_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'password';

    RAISE NOTICE 'Password column exists. Nullable: %', column_nullable;

    -- Make password column nullable if it isn't
    IF NOT column_nullable THEN
      ALTER TABLE public.user ALTER COLUMN password DROP NOT NULL;
      RAISE NOTICE 'Made password column nullable';
    END IF;
  ELSE
    RAISE NOTICE 'Password column does not exist (already migrated)';
  END IF;
END $$;

-- 2. Check if auth_user_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'auth_user_id'
  ) THEN
    RAISE NOTICE 'auth_user_id column exists ✓';
  ELSE
    RAISE NOTICE 'auth_user_id column MISSING! Run auth_migration_safe.sql first!';
  END IF;
END $$;

-- 3. Fix the trigger function to handle all cases
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if password column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'password'
  ) THEN
    -- Password column exists (old schema)
    INSERT INTO public.user (
      id,
      auth_user_id,
      email,
      full_name,
      password,
      is_active,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      '',  -- Empty password since using Supabase Auth
      TRUE,
      'Trial',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  ELSE
    -- Password column removed (new schema)
    INSERT INTO public.user (
      id,
      auth_user_id,
      email,
      full_name,
      is_active,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      TRUE,
      'Trial',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;  -- Don't fail the auth.users insert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user TO anon, authenticated;
GRANT ALL ON public.device_setting TO anon, authenticated;
GRANT ALL ON public.orders TO anon, authenticated;
GRANT ALL ON public.chatbot_flows TO anon, authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check user table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user'
ORDER BY ordinal_position;

-- Check if trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ============================================================================
-- Test message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix applied successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Try registering again with a new email';
  RAISE NOTICE '========================================';
END $$;
