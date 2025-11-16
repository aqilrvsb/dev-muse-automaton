-- Check current RLS status for packages table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'packages';

-- Check existing policies on packages table
SELECT * FROM pg_policies WHERE tablename = 'packages';

-- Disable RLS on packages table (for testing - re-enable with proper policies later)
ALTER TABLE public.packages DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled but allow admin users to update:
-- First enable RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access" ON public.packages;
DROP POLICY IF EXISTS "Allow admin full access" ON public.packages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.packages;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.packages;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.packages;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.packages;

-- Create new policies
-- Allow everyone to read packages
CREATE POLICY "Allow public read access" ON public.packages
    FOR SELECT
    TO public
    USING (true);

-- Allow authenticated users with admin role to do everything
CREATE POLICY "Allow admin full access" ON public.packages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."user" u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."user" u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );
