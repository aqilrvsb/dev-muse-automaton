-- Create user profile automatically on signup
-- This trigger creates a user record in public.user when a new auth.users record is created

-- First, drop the trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user (
    id,
    email,
    full_name,
    status,
    is_active,
    subscription_status,
    subscription_start,
    subscription_end,
    max_devices,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'Trial',
    true,
    'active',
    NOW(),
    NOW() + INTERVAL '2 days',
    1,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for user table to allow users to read their own data
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own data" ON public.user;
DROP POLICY IF EXISTS "Users can update their own data" ON public.user;

-- Allow users to read their own profile
CREATE POLICY "Users can read their own data"
  ON public.user
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile (full_name, phone)
CREATE POLICY "Users can update their own data"
  ON public.user
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role to do anything (for admin operations)
DROP POLICY IF EXISTS "Service role can do anything" ON public.user;
CREATE POLICY "Service role can do anything"
  ON public.user
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
