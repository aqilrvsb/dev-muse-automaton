-- ============================================================================
-- COMPLETE FIX FOR RLS AND USER ACCESS
-- ============================================================================

-- 1. Re-enable RLS on user table
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.user;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user;

-- 3. Create SIMPLE policies that WORK
-- Allow authenticated users to read their own profile
CREATE POLICY "authenticated_users_select_own"
  ON public.user
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "authenticated_users_update_own"
  ON public.user
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role (Edge Functions) to do everything
CREATE POLICY "service_role_all"
  ON public.user
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Create missing user profiles for any auth.users without public.user entry
INSERT INTO public.user (id, email, full_name, is_active, created_at, updated_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    true,
    au.created_at,
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.user pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

-- 5. Verify the fix worked
SELECT
    'Checking if current user can access their profile' as test,
    id,
    email,
    is_active
FROM public.user
WHERE id IN (SELECT id FROM auth.users)
LIMIT 5;

-- ============================================================================
-- DONE! Now test:
-- 1. Clear browser cache
-- 2. Login again
-- 3. Dashboard should load without infinite reload
-- ============================================================================
