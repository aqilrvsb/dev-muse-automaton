-- ============================================================================
-- ENABLE RLS ON DASHBOARD TABLES
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own device ai_whatsapp" ON public.ai_whatsapp;
DROP POLICY IF EXISTS "Service role full access ai_whatsapp" ON public.ai_whatsapp;
DROP POLICY IF EXISTS "Users can view own device wasapbot" ON public.wasapbot;
DROP POLICY IF EXISTS "Service role full access wasapbot" ON public.wasapbot;

-- Enable RLS on ai_whatsapp table
ALTER TABLE public.ai_whatsapp ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wasapbot table
ALTER TABLE public.wasapbot ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_whatsapp
-- Users can view their own device's conversations
CREATE POLICY "Users can view own device ai_whatsapp"
ON public.ai_whatsapp
FOR SELECT
TO authenticated
USING (
    id_device IN (
        SELECT id_device FROM public.device_setting
        WHERE user_id = auth.uid()
    )
);

-- Create policies for wasapbot
-- Users can view their own device's conversations
CREATE POLICY "Users can view own device wasapbot"
ON public.wasapbot
FOR SELECT
TO authenticated
USING (
    id_device IN (
        SELECT id_device FROM public.device_setting
        WHERE user_id = auth.uid()
    )
);

-- Service role can access everything
CREATE POLICY "Service role full access ai_whatsapp"
ON public.ai_whatsapp
FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access wasapbot"
ON public.wasapbot
FOR ALL
TO service_role
USING (true);

-- Grant permissions
GRANT SELECT ON public.ai_whatsapp TO authenticated;
GRANT SELECT ON public.wasapbot TO authenticated;
GRANT ALL ON public.ai_whatsapp TO service_role;
GRANT ALL ON public.wasapbot TO service_role;

SELECT 'RLS enabled on dashboard tables!' as message;
