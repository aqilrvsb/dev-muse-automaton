-- Allow admins to read all user data
-- This policy enables admin users (role='admin') to view all users in the User Register page
-- Uses a function to avoid infinite recursion

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.user
  WHERE id = auth.uid();

  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can read all users" ON public.user;
DROP POLICY IF EXISTS "Admins can update all users" ON public.user;

-- Allow admins to read all user data
CREATE POLICY "Admins can read all users"
  ON public.user
  FOR SELECT
  USING (public.is_admin());

-- Allow admins to update any user
CREATE POLICY "Admins can update all users"
  ON public.user
  FOR UPDATE
  USING (public.is_admin());
