-- ============================================================================
-- SUPABASE AUTH MIGRATION
-- ============================================================================
-- This migration syncs Supabase auth.users with public.user table
-- Old password-based auth will be replaced with Supabase Auth
-- ============================================================================

-- 1. Remove old password column (no longer needed with Supabase Auth)
ALTER TABLE public.user DROP COLUMN IF EXISTS password;

-- 2. Remove old user_sessions table (Supabase Auth handles sessions)
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- 3. Add auth_user_id to link with Supabase Auth
ALTER TABLE public.user
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Create trigger to auto-create user profile when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user (
    id,
    auth_user_id,
    email,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Update existing users (if any) to link with auth.users
-- This helps if you have test users in auth.users already
UPDATE public.user u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.email = au.email
AND u.auth_user_id IS NULL;

-- 6. Create RLS policies for user table
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do everything
CREATE POLICY "Service role can manage all users"
  ON public.user
  USING (auth.role() = 'service_role');

-- 7. Update device_setting RLS policies
ALTER TABLE public.device_setting ENABLE ROW LEVEL SECURITY;

-- Users can only see their own devices
CREATE POLICY "Users can view own devices"
  ON public.device_setting FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own devices
CREATE POLICY "Users can insert own devices"
  ON public.device_setting FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON public.device_setting FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON public.device_setting FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all devices
CREATE POLICY "Service role can manage all devices"
  ON public.device_setting
  USING (auth.role() = 'service_role');

-- 8. Update orders RLS policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all orders
CREATE POLICY "Service role can manage all orders"
  ON public.orders
  USING (auth.role() = 'service_role');

-- 9. Update chatbot_flows RLS (if needed)
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all flows (for now)
CREATE POLICY "Authenticated users can view flows"
  ON public.chatbot_flows FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage all flows
CREATE POLICY "Service role can manage all flows"
  ON public.chatbot_flows
  USING (auth.role() = 'service_role');

-- 10. Update function to use auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_device_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.device_setting
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create helper function to check if user can add device
CREATE OR REPLACE FUNCTION public.can_add_device(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_devices INTEGER;
BEGIN
  -- Get current device count
  v_current_count := public.get_user_device_count(p_user_id);

  -- Get max devices allowed
  SELECT COALESCE(max_devices, 1)
  INTO v_max_devices
  FROM public.user
  WHERE id = p_user_id;

  RETURN v_current_count < v_max_devices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. All new users will be created in auth.users via Supabase Auth
-- 2. A corresponding profile will be auto-created in public.user
-- 3. Old password column has been removed
-- 4. Old user_sessions table has been removed
-- 5. RLS policies are now in place for data security
-- ============================================================================
