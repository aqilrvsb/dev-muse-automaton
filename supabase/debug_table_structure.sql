-- Check the exact table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user'
ORDER BY ordinal_position;

-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user'
) as table_exists;

-- Try a simple select to see if it works
SELECT id, email, is_active FROM public.user LIMIT 5;

-- Check what auth.uid() returns (should be the logged-in user's ID)
SELECT auth.uid() as current_auth_uid;
