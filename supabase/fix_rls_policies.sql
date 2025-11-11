-- ============================================================================
-- FIX RLS POLICIES FOR USER TABLE
-- ============================================================================

-- Step 1: Drop ALL existing policies on user table
DROP POLICY IF EXISTS "Users can view own profile" ON public.user;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.user;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user;

-- Step 2: Enable RLS on user table
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new policies

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON public.user
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.user
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (needed for registration)
CREATE POLICY "Users can insert own profile"
ON public.user
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow service role to do everything (for backend operations)
CREATE POLICY "Service role full access"
ON public.user
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 4: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user TO authenticated;
GRANT ALL ON public.user TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'RLS Policies fixed!' as message;

-- Show all policies
SELECT
    policyname,
    cmd,
    roles,
    CASE
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        ELSE 'No USING clause'
    END as using_clause
FROM pg_policies
WHERE tablename = 'user' AND schemaname = 'public'
ORDER BY policyname;
