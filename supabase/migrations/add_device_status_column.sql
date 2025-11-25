-- Add status column to device_setting table
-- This stores the device connection status (CONNECTED, NOT_CONNECTED, etc.)
-- So Dashboard can read directly from database instead of calling API

ALTER TABLE public.device_setting
ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'UNKNOWN';

COMMENT ON COLUMN public.device_setting.status IS 'Device connection status: CONNECTED, NOT_CONNECTED, SCAN_QR_CODE, UNKNOWN';
