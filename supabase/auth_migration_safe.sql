-- ============================================================================
-- SAFE SUPABASE AUTH MIGRATION
-- ============================================================================
-- This migration safely syncs Supabase auth.users with public.user table
-- It handles existing policies and data without breaking anything
-- ============================================================================

-- 1. Add auth_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.user
      ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added auth_user_id column';
  ELSE
    RAISE NOTICE 'auth_user_id column already exists';
  END IF;
END $$;

-- 2. Create trigger function to auto-create user profile when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop and recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Update existing users to link with auth.users (if any match by email)
UPDATE public.user u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.email = au.email
AND u.auth_user_id IS NULL;

-- 5. Drop old policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.user;

-- 6. Create new RLS policies for user table
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (using auth.uid())
CREATE POLICY "Users can view own profile"
  ON public.user FOR SELECT
  USING (auth.uid() = id OR auth.uid() = auth_user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user FOR UPDATE
  USING (auth.uid() = id OR auth.uid() = auth_user_id);

-- Service role can do everything
CREATE POLICY "Service role can manage all users"
  ON public.user FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Update device_setting RLS policies (drop and recreate)
DROP POLICY IF EXISTS "Users can view own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can update own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can delete own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Service role can manage all devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can manage own devices" ON public.device_setting;

ALTER TABLE public.device_setting ENABLE ROW LEVEL SECURITY;

-- Users can manage their own devices
CREATE POLICY "Users can manage own devices"
  ON public.device_setting FOR ALL
  USING (auth.uid() = user_id);

-- Service role can manage all devices
CREATE POLICY "Service role can manage all devices"
  ON public.device_setting FOR ALL
  USING (auth.role() = 'service_role');

-- 8. Update orders RLS policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all orders
CREATE POLICY "Service role can manage all orders"
  ON public.orders FOR ALL
  USING (auth.role() = 'service_role');

-- 9. Update chatbot_flows RLS
DROP POLICY IF EXISTS "Users can manage own flows" ON public.chatbot_flows;
DROP POLICY IF EXISTS "Authenticated users can view flows" ON public.chatbot_flows;
DROP POLICY IF EXISTS "Service role can manage all flows" ON public.chatbot_flows;

ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

-- Users can manage flows for their devices
CREATE POLICY "Users can manage own flows"
  ON public.chatbot_flows FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.device_setting ds
      WHERE ds.id_device = chatbot_flows.id_device
        AND ds.user_id = auth.uid()
    )
  );

-- Service role can manage all flows
CREATE POLICY "Service role can manage all flows"
  ON public.chatbot_flows FOR ALL
  USING (auth.role() = 'service_role');

-- 10. IMPORTANT: Remove password column ONLY if you're sure
-- Uncomment the following lines ONLY after you've migrated all users to Supabase Auth
-- ALTER TABLE public.user DROP COLUMN IF EXISTS password;
-- DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- What was done:
-- ✅ Added auth_user_id column to link with Supabase Auth
-- ✅ Created trigger to auto-create user profiles on sign up
-- ✅ Updated existing users to link with auth.users (where emails match)
-- ✅ Updated all RLS policies to use auth.uid()
-- ✅ Enabled RLS on all user-related tables
--
-- Next steps:
-- 1. Test registration with a new account
-- 2. Test login with the new account
-- 3. If everything works, you can manually remove the password column
-- ============================================================================

-- Test the setup
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Open test-supabase-connection.html in browser';
  RAISE NOTICE '2. Click "Run All Tests"';
  RAISE NOTICE '3. Try registering a new user';
  RAISE NOTICE '========================================';
END $$;
