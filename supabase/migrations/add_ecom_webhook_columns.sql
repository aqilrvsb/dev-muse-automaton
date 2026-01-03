-- Migration: Add E-Commerce Webhook Columns to device_setting
-- Date: 2026-01-04

-- Add webhook-related columns to device_setting table
ALTER TABLE public.device_setting
ADD COLUMN IF NOT EXISTS ecom_webhook_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ecom_webhook_stage character varying DEFAULT 'new',
ADD COLUMN IF NOT EXISTS ecom_webhook_template text;

-- Add comment for documentation
COMMENT ON COLUMN public.device_setting.ecom_webhook_enabled IS 'Enable/disable WooCommerce webhook processing for this device';
COMMENT ON COLUMN public.device_setting.ecom_webhook_stage IS 'Stage to assign to leads created from WooCommerce orders';
COMMENT ON COLUMN public.device_setting.ecom_webhook_template IS 'Message template to send when WooCommerce order is received. Supports variables: {{name}}, {{phone}}, {{order_id}}, {{product}}, {{total}}, {{status}}, {{address}}';
