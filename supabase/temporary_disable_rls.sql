-- ============================================================================
-- TEMPORARY: Disable RLS to test if that's the issue
-- ============================================================================
-- WARNING: This makes ALL data publicly accessible
-- Only use for debugging, then re-enable RLS immediately
-- ============================================================================

-- Disable RLS on user table temporarily
ALTER TABLE public.user DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable with:
-- ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- This is ONLY for testing!
-- Once you confirm the infinite reload stops, re-enable RLS and fix policies
-- ============================================================================
