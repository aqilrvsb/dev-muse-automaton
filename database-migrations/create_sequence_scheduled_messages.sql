-- Create sequence_scheduled_messages table
-- This table tracks scheduled messages sent via WhatsApp Center API for sequence flows

CREATE TABLE IF NOT EXISTS public.sequence_scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  sequence_id uuid NOT NULL,
  flow_number integer NOT NULL,
  prospect_num character varying NOT NULL,
  device_id character varying NOT NULL,
  whacenter_message_id character varying,
  message text NOT NULL,
  image_url text,
  scheduled_time timestamp with time zone NOT NULL,
  status character varying NOT NULL DEFAULT 'scheduled'::character varying CHECK (status::text = ANY (ARRAY['scheduled'::character varying, 'sent'::character varying, 'cancelled'::character varying, 'failed'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequence_scheduled_messages_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_scheduled_messages_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  CONSTRAINT sequence_scheduled_messages_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sequence_scheduled_messages_prospect_device
  ON public.sequence_scheduled_messages(prospect_num, device_id);

CREATE INDEX IF NOT EXISTS idx_sequence_scheduled_messages_status
  ON public.sequence_scheduled_messages(status);

CREATE INDEX IF NOT EXISTS idx_sequence_scheduled_messages_enrollment
  ON public.sequence_scheduled_messages(enrollment_id);

-- Add comment
COMMENT ON TABLE public.sequence_scheduled_messages IS 'Tracks scheduled messages for sequence flows sent via WhatsApp Center API';
