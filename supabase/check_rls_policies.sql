-- Check if RLS is enabled on user table
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user' AND schemaname = 'public';

-- Check existing policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user' AND schemaname = 'public';

-- Check current user's auth status
SELECT
    auth.uid() as current_user_id,
    auth.role() as current_role;

-- Try to select from user table to see what happens
SELECT id, email, is_active, status
FROM public.user
WHERE id = auth.uid();
