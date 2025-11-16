-- ============================================================================
-- FIX USER ID SCHEMA TO MATCH chain-stock-flow-main
-- ============================================================================
-- Make user.id the SAME as auth.users.id (no separate auth_user_id needed)
-- ============================================================================

-- Step 1: Drop old policies FIRST (they reference auth_user_id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.user;

-- Step 2: Drop the separate auth_user_id column
-- (We'll use user.id as the auth user ID directly)

-- Drop the foreign key constraint
ALTER TABLE public.user DROP CONSTRAINT IF EXISTS user_auth_user_id_fkey;

-- Now drop the auth_user_id column
ALTER TABLE public.user DROP COLUMN IF EXISTS auth_user_id;

-- Step 3: Update the trigger to use id directly (like chain-stock-flow-main)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert with auth.users.id as the primary key
  INSERT INTO public.user (
    id,                    -- Use auth.users.id directly (like chain-stock-flow-main profiles table)
    email,
    full_name,
    is_active,
    status,
    max_devices,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,               -- This is auth.users.id
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    TRUE,
    'Trial',
    1,                    -- Default 1 device for trial
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;  -- Don't fail the auth.users insert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4.5: Delete orphaned users (users that don't exist in auth.users)
-- This prevents FK constraint violation
DELETE FROM public.user
WHERE id NOT IN (SELECT id FROM auth.users);

-- Step 5: Add foreign key constraint to link user.id with auth.users.id
ALTER TABLE public.user
  ADD CONSTRAINT user_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: Create NEW RLS policies using auth.uid() = id (like chain-stock-flow-main)
CREATE POLICY "Users can view own profile"
  ON public.user FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users"
  ON public.user FOR ALL
  USING (auth.role() = 'service_role');

-- Step 7: Link existing users
-- For any existing users in auth.users, update the user table
-- This assumes email matching (adjust if needed)
DO $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    INSERT INTO public.user (
      id,
      email,
      full_name,
      is_active,
      status,
      created_at,
      updated_at
    ) VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'full_name', 'User'),
      TRUE,
      'Trial',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Schema fixed! Now user.id matches auth.users.id (like chain-stock-flow-main)' as message;

-- Show current users
SELECT
  u.id,
  u.email,
  u.full_name,
  u.is_active,
  u.status,
  au.id as auth_id,
  CASE WHEN u.id = au.id THEN '✓ MATCHED' ELSE '✗ MISMATCH' END as id_check
FROM public.user u
LEFT JOIN auth.users au ON u.id = au.id;
