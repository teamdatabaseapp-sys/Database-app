-- ============================================
-- BUSINESS INFORMATION MIGRATION
-- Adds columns for CAN-SPAM compliance and business contact info
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Add business information columns
-- ============================================

-- Physical business address (required for CAN-SPAM email compliance)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_address TEXT;

-- Business phone number for contact/email signatures
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_phone_number TEXT;

-- Country code (ISO 3166-1 alpha-2, e.g., 'US', 'CA', 'GB')
-- Used for legal compliance and formatting
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_country TEXT;

-- US state code (e.g., 'CA', 'NY') - only relevant for US businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_state TEXT;

-- Email footer language preference (ISO 639-1, e.g., 'en', 'es', 'fr')
-- Controls the language of unsubscribe links and legal text in emails
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS email_footer_language TEXT DEFAULT 'en';

-- Updated timestamp for tracking changes
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- STEP 2: Create trigger for auto-updating updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_businesses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS businesses_updated_at_trigger ON public.businesses;

-- Create the trigger
CREATE TRIGGER businesses_updated_at_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_businesses_updated_at();

-- ============================================
-- STEP 3: Add index for faster queries
-- ============================================

-- Index for country-based queries (useful for compliance reports)
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses(business_country);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- New columns added to businesses table:
--   - business_address: Physical address (CAN-SPAM compliance)
--   - business_phone_number: Contact phone number
--   - business_country: ISO country code
--   - business_state: US state code (optional, for US businesses)
--   - email_footer_language: Language for email footers
--   - updated_at: Timestamp for tracking changes
--
-- RLS policies already exist for businesses table,
-- no additional policy changes needed.
-- ============================================
