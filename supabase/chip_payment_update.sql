-- ============================================================================
-- CHIP PAYMENT SCHEMA UPDATE
-- ============================================================================
-- Safe to run multiple times - only adds missing components
-- ============================================================================

-- 1. Ensure subscription fields exist on user table
DO $$
BEGIN
  -- Add package_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'package_id'
  ) THEN
    ALTER TABLE public.user ADD COLUMN package_id UUID;
  END IF;

  -- Add subscription_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.user ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'inactive';
  END IF;

  -- Add subscription_start if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'subscription_start'
  ) THEN
    ALTER TABLE public.user ADD COLUMN subscription_start TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add subscription_end if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'subscription_end'
  ) THEN
    ALTER TABLE public.user ADD COLUMN subscription_end TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add max_devices if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user'
    AND column_name = 'max_devices'
  ) THEN
    ALTER TABLE public.user ADD COLUMN max_devices INTEGER DEFAULT 1;
  END IF;
END $$;

-- 2. Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'user'
    AND constraint_name = 'user_package_id_fkey'
  ) THEN
    ALTER TABLE public.user
    ADD CONSTRAINT user_package_id_fkey
    FOREIGN KEY (package_id) REFERENCES public.packages(id);
  END IF;
END $$;

-- 3. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_chip_purchase_id ON public.payments(chip_purchase_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.packages(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscription_status ON public.user(subscription_status);

-- 4. Insert default packages (only if they don't exist)
INSERT INTO public.packages (name, description, price, duration_days, max_devices, features)
SELECT * FROM (VALUES
  ('Starter', 'Perfect for individuals and small businesses', 29.00, 30, 1, '["1 WhatsApp Device", "Basic Flow Builder", "1000 Messages/Month", "Email Support"]'::jsonb),
  ('Pro', 'Great for growing businesses', 99.00, 30, 5, '["5 WhatsApp Devices", "Advanced Flow Builder", "10000 Messages/Month", "AI Chatbot Integration", "Priority Support"]'::jsonb),
  ('Enterprise', 'For large teams and agencies', 299.00, 30, 20, '["20 WhatsApp Devices", "Unlimited Flow Builder", "100000 Messages/Month", "Full AI Chatbot", "Dedicated Support", "Custom Integrations"]'::jsonb)
) AS v(name, description, price, duration_days, max_devices, features)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages WHERE packages.name = v.name
);

-- 5. Create helper functions
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

-- 6. Enable RLS on tables
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.packages;
CREATE POLICY "Anyone can view active packages"
  ON public.packages FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
CREATE POLICY "Users can create own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all payments" ON public.payments;
CREATE POLICY "Service role can manage all payments"
  ON public.payments
  USING (auth.role() = 'service_role');

-- 8. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Apply triggers
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
-- DONE! Your CHIP payment schema is now up to date.
-- ============================================================================
