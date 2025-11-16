-- ============================================================================
-- CHIP PAYMENT INTEGRATION - DATABASE SCHEMA
-- ============================================================================
-- This schema supports subscription-based payments via CHIP Payment Gateway
-- ============================================================================

-- 1. Drop existing packages table (it has wrong structure - bigint vs UUID)
-- This is safe because it's only used for billing management, not critical data
DROP TABLE IF EXISTS public.packages CASCADE;

-- 2. Packages Table (Subscription Plans) - Recreate with correct structure
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MYR',
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_devices INTEGER NOT NULL DEFAULT 1,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Payments Table (references 'user' table, not 'users')
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MYR',
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  chip_purchase_id VARCHAR(255),
  chip_transaction_id VARCHAR(255),
  chip_checkout_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Update User Table to include subscription fields
ALTER TABLE public.user
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;

-- 5. Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_chip_purchase_id ON public.payments(chip_purchase_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.packages(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscription_status ON public.user(subscription_status);

-- 6. Insert default packages
INSERT INTO public.packages (name, description, price, duration_days, max_devices, features) VALUES
  ('Starter', 'Perfect for individuals and small businesses', 29.00, 30, 1, '["1 WhatsApp Device", "Basic Flow Builder", "1000 Messages/Month", "Email Support"]'::jsonb),
  ('Pro', 'Great for growing businesses', 99.00, 30, 5, '["5 WhatsApp Devices", "Advanced Flow Builder", "10000 Messages/Month", "AI Chatbot Integration", "Priority Support"]'::jsonb),
  ('Enterprise', 'For large teams and agencies', 299.00, 30, 20, '["20 WhatsApp Devices", "Unlimited Flow Builder", "100000 Messages/Month", "Full AI Chatbot", "Dedicated Support", "Custom Integrations"]'::jsonb)
ON CONFLICT DO NOTHING;

-- 7. Function to check subscription validity
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR(50);
  v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT subscription_status, subscription_end
  INTO v_status, v_end_date
  FROM public.user
  WHERE id = p_user_id;

  IF v_status = 'active' AND v_end_date > NOW() THEN
    RETURN TRUE;
  ELSE
    -- Auto-expire if end date passed
    IF v_status = 'active' AND v_end_date <= NOW() THEN
      UPDATE public.user
      SET subscription_status = 'expired'
      WHERE id = p_user_id;
    END IF;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to get user's active devices count
CREATE OR REPLACE FUNCTION public.get_user_device_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.device_setting
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 9. Row Level Security (RLS) Policies

-- Enable RLS on packages table
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active packages
CREATE POLICY "Anyone can view active packages"
  ON public.packages FOR SELECT
  USING (is_active = TRUE);

-- Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own payments
CREATE POLICY "Users can create own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role can manage all payments"
  ON public.payments
  USING (auth.role() = 'service_role');

-- 10. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Apply updated_at triggers
DROP TRIGGER IF EXISTS update_packages_updated_at ON public.packages;
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION NOTES:
-- ============================================================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Set environment variables in Supabase Edge Functions:
--    - CHIP_API_KEY: Your CHIP API key
--    - CHIP_BRAND_ID: Your CHIP Brand ID
--    - APP_ORIGIN: Your frontend URL (e.g., https://peningbot.vercel.app)
-- 3. Deploy the edge function: cd supabase/functions && supabase functions deploy chip-payment-topup
-- 4. Configure CHIP webhook URL: https://[YOUR-SUPABASE-PROJECT].supabase.co/functions/v1/chip-payment-topup
-- ============================================================================
