-- Add password column to user table for admin reference
-- This stores a plaintext password that admins can view/edit

ALTER TABLE public.user ADD COLUMN IF NOT EXISTS password character varying;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.user.password IS 'Plaintext password for admin reference - not used for authentication';
