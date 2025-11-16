-- Sequences table for automated message campaigns
CREATE TABLE IF NOT EXISTS public.sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  niche character varying NOT NULL,
  trigger character varying NOT NULL,
  description text NOT NULL,
  schedule_time character varying NOT NULL DEFAULT '09:00',
  min_delay integer NOT NULL DEFAULT 5,
  max_delay integer NOT NULL DEFAULT 15,
  status character varying NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequences_pkey PRIMARY KEY (id),
  CONSTRAINT sequences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user(id) ON DELETE CASCADE
);

-- Sequence flows table for individual flow messages
CREATE TABLE IF NOT EXISTS public.sequence_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL,
  flow_number integer NOT NULL,
  step_trigger character varying NOT NULL,
  next_trigger character varying,
  delay_hours integer NOT NULL DEFAULT 24,
  message text NOT NULL,
  image_url text,
  is_end boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequence_flows_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_flows_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE,
  CONSTRAINT sequence_flows_unique_flow UNIQUE (sequence_id, flow_number)
);

-- Sequence enrollments table to track contacts in sequences
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL,
  prospect_num character varying NOT NULL,
  current_flow_number integer NOT NULL DEFAULT 1,
  status character varying NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_sent_at timestamp with time zone,
  next_message_scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE,
  CONSTRAINT sequence_enrollments_unique_enrollment UNIQUE (sequence_id, prospect_num)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON public.sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON public.sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_trigger ON public.sequences(trigger);

CREATE INDEX IF NOT EXISTS idx_sequence_flows_sequence_id ON public.sequence_flows(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_flows_flow_number ON public.sequence_flows(sequence_id, flow_number);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON public.sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_prospect_num ON public.sequence_enrollments(prospect_num);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON public.sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_scheduled ON public.sequence_enrollments(next_message_scheduled_at) WHERE status = 'active';

-- Enable Row Level Security (RLS)
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sequences table
-- Users can only see their own sequences
CREATE POLICY "Users can view own sequences" ON public.sequences
  FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can insert their own sequences
CREATE POLICY "Users can insert own sequences" ON public.sequences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sequences
CREATE POLICY "Users can update own sequences" ON public.sequences
  FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can delete their own sequences
CREATE POLICY "Users can delete own sequences" ON public.sequences
  FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for sequence_flows table
-- Users can view flows for their sequences
CREATE POLICY "Users can view own sequence flows" ON public.sequence_flows
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_flows.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- Users can insert flows for their sequences
CREATE POLICY "Users can insert own sequence flows" ON public.sequence_flows
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_flows.sequence_id
    AND sequences.user_id = auth.uid()
  ));

-- Users can update flows for their sequences
CREATE POLICY "Users can update own sequence flows" ON public.sequence_flows
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_flows.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- Users can delete flows for their sequences
CREATE POLICY "Users can delete own sequence flows" ON public.sequence_flows
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_flows.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- RLS Policies for sequence_enrollments table
-- Users can view enrollments for their sequences
CREATE POLICY "Users can view own sequence enrollments" ON public.sequence_enrollments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_enrollments.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- Users can insert enrollments for their sequences
CREATE POLICY "Users can insert own sequence enrollments" ON public.sequence_enrollments
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_enrollments.sequence_id
    AND sequences.user_id = auth.uid()
  ));

-- Users can update enrollments for their sequences
CREATE POLICY "Users can update own sequence enrollments" ON public.sequence_enrollments
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_enrollments.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- Users can delete enrollments for their sequences
CREATE POLICY "Users can delete own sequence enrollments" ON public.sequence_enrollments
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sequences
    WHERE sequences.id = sequence_enrollments.sequence_id
    AND (sequences.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user WHERE id = auth.uid() AND role = 'admin'
    ))
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON public.sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequence_flows_updated_at
  BEFORE UPDATE ON public.sequence_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequence_enrollments_updated_at
  BEFORE UPDATE ON public.sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View to get sequence with flow count and enrollment count
CREATE OR REPLACE VIEW public.sequences_with_stats AS
SELECT
  s.id,
  s.user_id,
  s.name,
  s.niche,
  s.trigger,
  s.description,
  s.schedule_time,
  s.min_delay,
  s.max_delay,
  s.status,
  s.created_at,
  s.updated_at,
  COUNT(DISTINCT sf.id) AS flow_count,
  COUNT(DISTINCT se.id) AS enrollment_count,
  COUNT(DISTINCT CASE WHEN se.status = 'active' THEN se.id END) AS active_enrollments,
  COUNT(DISTINCT CASE WHEN se.status = 'completed' THEN se.id END) AS completed_enrollments
FROM public.sequences s
LEFT JOIN public.sequence_flows sf ON s.id = sf.sequence_id
LEFT JOIN public.sequence_enrollments se ON s.id = se.sequence_id
GROUP BY s.id, s.user_id, s.name, s.niche, s.trigger, s.description, s.schedule_time, s.min_delay, s.max_delay, s.status, s.created_at, s.updated_at;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON public.sequences TO authenticated;
-- GRANT ALL ON public.sequence_flows TO authenticated;
-- GRANT ALL ON public.sequence_enrollments TO authenticated;
-- GRANT SELECT ON public.sequences_with_stats TO authenticated;
