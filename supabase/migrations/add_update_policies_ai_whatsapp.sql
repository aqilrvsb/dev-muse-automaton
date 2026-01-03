-- ============================================================================
-- ADD UPDATE POLICIES FOR AI_WHATSAPP AND WASAPBOT TABLES
-- This allows users to update conversations (like changing human/AI status)
-- ============================================================================

-- Drop existing update policies if they exist
DROP POLICY IF EXISTS "Users can update own device ai_whatsapp" ON public.ai_whatsapp;
DROP POLICY IF EXISTS "Users can update own device wasapbot" ON public.wasapbot;

-- Create UPDATE policy for ai_whatsapp
-- Users can update conversations for their own devices
CREATE POLICY "Users can update own device ai_whatsapp"
ON public.ai_whatsapp
FOR UPDATE
TO authenticated
USING (
    device_id IN (
        SELECT device_id FROM public.device_setting
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    device_id IN (
        SELECT device_id FROM public.device_setting
        WHERE user_id = auth.uid()
    )
);

-- Create UPDATE policy for wasapbot
-- Users can update conversations for their own devices
CREATE POLICY "Users can update own device wasapbot"
ON public.wasapbot
FOR UPDATE
TO authenticated
USING (
    id_device IN (
        SELECT device_id FROM public.device_setting
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    id_device IN (
        SELECT device_id FROM public.device_setting
        WHERE user_id = auth.uid()
    )
);

-- Grant UPDATE permissions
GRANT UPDATE ON public.ai_whatsapp TO authenticated;
GRANT UPDATE ON public.wasapbot TO authenticated;

SELECT 'UPDATE policies added for ai_whatsapp and wasapbot tables!' as message;
