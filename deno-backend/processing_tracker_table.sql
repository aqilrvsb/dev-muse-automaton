-- Create processing_tracker table for duplicate prevention
-- This table tracks message processing to prevent duplicate sends

CREATE TABLE IF NOT EXISTS public.processing_tracker (
  id BIGSERIAL PRIMARY KEY,
  id_prospect VARCHAR(255),
  flow_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_processing_tracker_prospect ON public.processing_tracker(id_prospect, flow_type);
