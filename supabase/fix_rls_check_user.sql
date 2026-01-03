-- ============================================================================
-- DIAGNOSE AND FIX USER RLS ISSUE
-- ============================================================================

-- 1. Check if user exists in auth.users
SELECT
    'auth.users' as table_name,
    id,
    email,
    created_at,
    confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if user exists in public.user
SELECT
    'public.user' as table_name,
    id,
    email,
    full_name,
    is_active,
    created_at
FROM public.user
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check for mismatches (users in auth.users but not in public.user)
SELECT
    'Missing in public.user' as issue,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.user pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 4. FIX: Create missing user profiles
INSERT INTO public.user (id, email, full_name, is_active, created_at, updated_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    true,
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN public.user pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Verify RLS policies exist
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'user'
AND schemaname = 'public'
ORDER BY policyname;

-- 6. Test if current policies work
-- This should return the user if RLS is working correctly
SELECT
    id,
    email,
    is_active
FROM public.user
WHERE id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);

-- ============================================================================
-- After running this, check the results:
-- - If "Missing in public.user" shows rows, they will be auto-created
-- - If RLS policies are missing, re-run auth_migration_update.sql
-- - If the final SELECT returns empty, there's still an RLS issue
-- ============================================================================
