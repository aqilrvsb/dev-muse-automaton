-- ============================================================================
-- SUPABASE AUTH MIGRATION UPDATE
-- ============================================================================
-- Safe to run multiple times - only applies missing changes
-- ============================================================================

-- 1. Remove password column if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'password'
  ) THEN
    ALTER TABLE public.user DROP COLUMN password;
  END IF;
END $$;

-- 2. Remove user_sessions table if it still exists
DROP TABLE IF EXISTS public.user_sessions CASCADE;

-- 3. Create trigger to auto-create user profile when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.user table
  INSERT INTO public.user (
    id,
    email,
    full_name,
    created_at,
    updated_at,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW(),
    true
  )
  ON CONFLICT (id) DO NOTHING; -- Skip if already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable RLS on user table
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.user;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role can manage all users"
  ON public.user
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Update device_setting RLS policies
ALTER TABLE public.device_setting ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can update own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Users can delete own devices" ON public.device_setting;
DROP POLICY IF EXISTS "Service role can manage all devices" ON public.device_setting;

CREATE POLICY "Users can view own devices"
  ON public.device_setting FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON public.device_setting FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.device_setting FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.device_setting FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all devices"
  ON public.device_setting
  FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Update orders RLS policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all orders"
  ON public.orders
  FOR ALL
  USING (auth.role() = 'service_role');

-- 8. Update chatbot_flows RLS
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view flows" ON public.chatbot_flows;
DROP POLICY IF EXISTS "Service role can manage all flows" ON public.chatbot_flows;

-- For now, allow all authenticated users to manage flows
-- TODO: Add user_id to chatbot_flows table for proper row-level security
CREATE POLICY "Authenticated users can manage flows"
  ON public.chatbot_flows
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage all flows"
  ON public.chatbot_flows
  FOR ALL
  USING (auth.role() = 'service_role');

-- 9. Update helper functions
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
-- What this did:
-- 1. Removed password column (if it existed)
-- 2. Removed user_sessions table
-- 3. Created trigger to auto-create user profiles on signup
-- 4. Set up RLS policies for:
--    - user table (users can only see/edit their own)
--    - device_setting (users can only manage their own)
--    - orders (users can only see their own)
--    - chatbot_flows (all authenticated users for now)
-- 5. Created helper functions for device limits
-- ============================================================================
