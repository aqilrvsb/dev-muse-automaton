-- Add schedule_message column to sequence_enrollments table
-- This column stores the scheduled time in Malaysia timezone (UTC+8) for tracking

ALTER TABLE public.sequence_enrollments
ADD COLUMN IF NOT EXISTS schedule_message timestamp with time zone;

-- Add comment
COMMENT ON COLUMN public.sequence_enrollments.schedule_message IS 'Scheduled message time in Malaysia timezone (UTC+8)';
