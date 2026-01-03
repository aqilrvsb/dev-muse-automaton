-- =============================================
-- DEV-MUSE-AUTOMATON DATABASE SCHEMA
-- Last Updated: 2026-01-04
-- =============================================

-- =============================================
-- TABLE: ai_whatsapp (Main conversation/prospect table)
-- =============================================
CREATE TABLE public.ai_whatsapp (
    id_prospect uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NULL,
    prospect_name character varying NULL,
    prospect_num character varying NULL,
    messages jsonb NULL DEFAULT '[]'::jsonb,
    ai_enabled boolean NULL DEFAULT true,
    last_message_at timestamp with time zone NULL DEFAULT now(),
    stage character varying NULL DEFAULT 'new'::character varying,
    created_at timestamp with time zone NULL DEFAULT now(),
    flow_id uuid NULL,
    current_node_id character varying NULL,
    flow_variables jsonb NULL DEFAULT '{}'::jsonb,
    awaiting_input boolean NULL DEFAULT false,
    awaiting_input_variable character varying NULL,
    last_ai_response text NULL,
    last_user_message text NULL,
    sequence_id uuid NULL,
    sequence_step integer NULL DEFAULT 0,
    sequence_status character varying NULL DEFAULT 'pending'::character varying,
    next_sequence_at timestamp with time zone NULL,
    device_id character varying NULL,
    CONSTRAINT ai_whatsapp_pkey PRIMARY KEY (id_prospect),
    CONSTRAINT ai_whatsapp_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE SET NULL,
    CONSTRAINT ai_whatsapp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_whatsapp_device_id ON public.ai_whatsapp USING btree (device_id);
CREATE INDEX idx_ai_whatsapp_flow_id ON public.ai_whatsapp USING btree (flow_id);
CREATE INDEX idx_ai_whatsapp_prospect_num ON public.ai_whatsapp USING btree (prospect_num);
CREATE INDEX idx_ai_whatsapp_sequence ON public.ai_whatsapp USING btree (sequence_id, sequence_status, next_sequence_at);
CREATE INDEX idx_ai_whatsapp_user_id ON public.ai_whatsapp USING btree (user_id);

-- =============================================
-- TABLE: device_setting (WhatsApp device configuration)
-- =============================================
CREATE TABLE public.device_setting (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    device_id character varying NOT NULL,
    device_name character varying NULL,
    status character varying NULL DEFAULT 'disconnected'::character varying,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    session_data jsonb NULL,
    is_default boolean NULL DEFAULT false,
    -- WooCommerce Webhook Settings
    ecom_webhook_enabled boolean NULL DEFAULT false,
    ecom_webhook_stage character varying NULL DEFAULT 'new'::character varying,
    ecom_webhook_template text NULL,
    CONSTRAINT device_setting_pkey PRIMARY KEY (id),
    CONSTRAINT device_setting_device_id_key UNIQUE (device_id),
    CONSTRAINT device_setting_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_setting_device_id ON public.device_setting USING btree (device_id);
CREATE INDEX idx_device_setting_user_id ON public.device_setting USING btree (user_id);

-- =============================================
-- TABLE: flows (Flow builder flows)
-- =============================================
CREATE TABLE public.flows (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    description text NULL,
    nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
    edges jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NULL DEFAULT false,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    trigger_type character varying NULL DEFAULT 'manual'::character varying,
    trigger_config jsonb NULL DEFAULT '{}'::jsonb,
    variables jsonb NULL DEFAULT '[]'::jsonb,
    CONSTRAINT flows_pkey PRIMARY KEY (id),
    CONSTRAINT flows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_flows_is_active ON public.flows USING btree (is_active);
CREATE INDEX idx_flows_trigger_type ON public.flows USING btree (trigger_type);
CREATE INDEX idx_flows_user_id ON public.flows USING btree (user_id);

-- =============================================
-- TABLE: flow_executions (Flow execution logs)
-- =============================================
CREATE TABLE public.flow_executions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    flow_id uuid NOT NULL,
    prospect_id uuid NULL,
    status character varying NOT NULL DEFAULT 'running'::character varying,
    current_node_id character varying NULL,
    variables jsonb NULL DEFAULT '{}'::jsonb,
    logs jsonb NULL DEFAULT '[]'::jsonb,
    started_at timestamp with time zone NULL DEFAULT now(),
    completed_at timestamp with time zone NULL,
    error_message text NULL,
    CONSTRAINT flow_executions_pkey PRIMARY KEY (id),
    CONSTRAINT flow_executions_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    CONSTRAINT flow_executions_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES ai_whatsapp(id_prospect) ON DELETE SET NULL
);

CREATE INDEX idx_flow_executions_flow_id ON public.flow_executions USING btree (flow_id);
CREATE INDEX idx_flow_executions_prospect_id ON public.flow_executions USING btree (prospect_id);
CREATE INDEX idx_flow_executions_status ON public.flow_executions USING btree (status);

-- =============================================
-- TABLE: sequences (Message sequences)
-- =============================================
CREATE TABLE public.sequences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    description text NULL,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NULL DEFAULT true,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    trigger_type character varying NULL DEFAULT 'manual'::character varying,
    trigger_config jsonb NULL DEFAULT '{}'::jsonb,
    CONSTRAINT sequences_pkey PRIMARY KEY (id),
    CONSTRAINT sequences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sequences_is_active ON public.sequences USING btree (is_active);
CREATE INDEX idx_sequences_user_id ON public.sequences USING btree (user_id);

-- =============================================
-- TABLE: sequence_enrollments (Prospect sequence tracking)
-- =============================================
CREATE TABLE public.sequence_enrollments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sequence_id uuid NOT NULL,
    prospect_id uuid NOT NULL,
    current_step integer NULL DEFAULT 0,
    status character varying NULL DEFAULT 'active'::character varying,
    enrolled_at timestamp with time zone NULL DEFAULT now(),
    next_step_at timestamp with time zone NULL,
    completed_at timestamp with time zone NULL,
    variables jsonb NULL DEFAULT '{}'::jsonb,
    CONSTRAINT sequence_enrollments_pkey PRIMARY KEY (id),
    CONSTRAINT sequence_enrollments_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES ai_whatsapp(id_prospect) ON DELETE CASCADE,
    CONSTRAINT sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
);

CREATE INDEX idx_sequence_enrollments_next_step ON public.sequence_enrollments USING btree (next_step_at) WHERE (status = 'active'::text);
CREATE INDEX idx_sequence_enrollments_prospect_id ON public.sequence_enrollments USING btree (prospect_id);
CREATE INDEX idx_sequence_enrollments_sequence_id ON public.sequence_enrollments USING btree (sequence_id);
CREATE INDEX idx_sequence_enrollments_status ON public.sequence_enrollments USING btree (status);

-- =============================================
-- TABLE: ai_prompt (AI prompts configuration)
-- =============================================
CREATE TABLE public.ai_prompt (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    prompt_name character varying NOT NULL,
    prompt_text text NOT NULL,
    is_active boolean NULL DEFAULT false,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    model character varying NULL DEFAULT 'gpt-4o-mini'::character varying,
    temperature numeric NULL DEFAULT 0.7,
    max_tokens integer NULL DEFAULT 500,
    CONSTRAINT ai_prompt_pkey PRIMARY KEY (id),
    CONSTRAINT ai_prompt_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_prompt_is_active ON public.ai_prompt USING btree (is_active);
CREATE INDEX idx_ai_prompt_user_id ON public.ai_prompt USING btree (user_id);

-- =============================================
-- TABLE: api_keys (API key storage)
-- =============================================
CREATE TABLE public.api_keys (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    service character varying NOT NULL,
    api_key text NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT api_keys_pkey PRIMARY KEY (id),
    CONSTRAINT api_keys_user_id_service_key UNIQUE (user_id, service),
    CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user_id ON public.api_keys USING btree (user_id);

-- =============================================
-- TABLE: stages (Pipeline stages)
-- =============================================
CREATE TABLE public.stages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    color character varying NULL DEFAULT '#3b82f6'::character varying,
    "order" integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT stages_pkey PRIMARY KEY (id),
    CONSTRAINT stages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_stages_user_id ON public.stages USING btree (user_id);

-- =============================================
-- TABLE: user_credits (Credit system)
-- =============================================
CREATE TABLE public.user_credits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    credits integer NOT NULL DEFAULT 0,
    lifetime_credits integer NOT NULL DEFAULT 0,
    last_updated timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT user_credits_pkey PRIMARY KEY (id),
    CONSTRAINT user_credits_user_id_key UNIQUE (user_id),
    CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: credit_transactions (Credit usage history)
-- =============================================
CREATE TABLE public.credit_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    type character varying NOT NULL,
    description text NULL,
    reference_id character varying NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions USING btree (created_at);
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions USING btree (user_id);

-- =============================================
-- TABLE: profiles (User profiles)
-- =============================================
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name character varying NULL,
    avatar_url text NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: user_roles (User role management)
-- =============================================
CREATE TABLE public.user_roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role character varying NOT NULL DEFAULT 'user'::character varying,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT user_roles_pkey PRIMARY KEY (id),
    CONSTRAINT user_roles_user_id_key UNIQUE (user_id),
    CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: packages (Subscription packages)
-- =============================================
CREATE TABLE public.packages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    description text NULL,
    price numeric NOT NULL,
    credits integer NOT NULL,
    features jsonb NULL DEFAULT '[]'::jsonb,
    is_active boolean NULL DEFAULT true,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    billing_cycle character varying NULL DEFAULT 'monthly'::character varying,
    CONSTRAINT packages_pkey PRIMARY KEY (id)
);

-- =============================================
-- TABLE: user_subscriptions (User subscription tracking)
-- =============================================
CREATE TABLE public.user_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    package_id uuid NOT NULL,
    status character varying NOT NULL DEFAULT 'active'::character varying,
    started_at timestamp with time zone NULL DEFAULT now(),
    expires_at timestamp with time zone NULL,
    payment_reference character varying NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT user_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES packages(id),
    CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions USING btree (status);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);

-- =============================================
-- TABLE: payments (Payment records)
-- =============================================
CREATE TABLE public.payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    currency character varying NULL DEFAULT 'MYR'::character varying,
    status character varying NOT NULL DEFAULT 'pending'::character varying,
    payment_method character varying NULL,
    payment_reference character varying NULL,
    package_id uuid NULL,
    credits_added integer NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NULL DEFAULT now(),
    completed_at timestamp with time zone NULL,
    CONSTRAINT payments_pkey PRIMARY KEY (id),
    CONSTRAINT payments_package_id_fkey FOREIGN KEY (package_id) REFERENCES packages(id),
    CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_payments_status ON public.payments USING btree (status);
CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);

-- =============================================
-- TABLE: knowledge_base (RAG knowledge documents)
-- =============================================
CREATE TABLE public.knowledge_base (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    embedding vector(1536) NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT knowledge_base_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_base_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_knowledge_base_embedding ON public.knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_base_user_id ON public.knowledge_base USING btree (user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: match_knowledge (for RAG similarity search)
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector,
    match_threshold double precision,
    match_count integer,
    p_user_id uuid
)
RETURNS TABLE(
    id uuid,
    title character varying,
    content text,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE kb.user_id = p_user_id
        AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = check_user_id AND role = 'admin'
    );
END;
$$;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.ai_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (users can only access their own data)
CREATE POLICY "Users can view own data" ON public.ai_whatsapp
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON public.ai_whatsapp
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON public.ai_whatsapp
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON public.ai_whatsapp
    FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for webhook operations
CREATE POLICY "Service role full access" ON public.ai_whatsapp
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');
