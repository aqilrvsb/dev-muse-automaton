-- Create bank_images table
CREATE TABLE IF NOT EXISTS public.bank_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
  name character varying NOT NULL,
  image_url text NOT NULL,
  blob_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.bank_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bank images
CREATE POLICY "Users can view own bank images"
  ON public.bank_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own bank images
CREATE POLICY "Users can insert own bank images"
  ON public.bank_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bank images
CREATE POLICY "Users can update own bank images"
  ON public.bank_images
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own bank images
CREATE POLICY "Users can delete own bank images"
  ON public.bank_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_images_user_id ON public.bank_images(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_images_created_at ON public.bank_images(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_images_updated_at
  BEFORE UPDATE ON public.bank_images
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_images_updated_at();
