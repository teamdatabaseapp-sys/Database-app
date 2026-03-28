-- ============================================
-- SUPABASE BRANDING & EMAIL TEMPLATES MIGRATION
--
-- This migration adds:
-- 1. Business branding columns (logo, colors)
-- 2. Email template table for booking emails
-- 3. Storage bucket setup instructions
-- 4. Public function for fetching branding
-- ============================================

-- ============================================
-- STEP 1: Add branding columns to businesses table
-- ============================================

-- Logo path in Supabase Storage (e.g., "logos/{business_id}/logo_256.png")
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS logo_path TEXT DEFAULT NULL;

-- Cached public URL for the logo
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

-- Primary brand color (used for CTAs, headers, highlights)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT NOT NULL DEFAULT '#0F8F83';

-- Secondary brand color (optional accent)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT NULL;

-- Track when branding was last updated (for cache invalidation)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS brand_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================
-- STEP 2: Create trigger to auto-update brand_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_businesses_brand_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.logo_path IS DISTINCT FROM NEW.logo_path OR
    OLD.logo_url IS DISTINCT FROM NEW.logo_url OR
    OLD.brand_primary_color IS DISTINCT FROM NEW.brand_primary_color OR
    OLD.brand_secondary_color IS DISTINCT FROM NEW.brand_secondary_color
  ) THEN
    NEW.brand_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_brand_updated_at_trigger ON public.businesses;

CREATE TRIGGER businesses_brand_updated_at_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_businesses_brand_updated_at();

-- ============================================
-- STEP 3: Create booking email templates table
-- ============================================

-- Stores customized email templates per business
-- If no override exists, system uses default template
CREATE TABLE IF NOT EXISTS public.booking_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Template type: confirmation, cancellation, rescheduled, reminder
  template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'cancellation', 'rescheduled', 'reminder')),

  -- Language code (matches booking page locales)
  locale TEXT NOT NULL DEFAULT 'en',

  -- Whether this template type is enabled
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Custom subject (if NULL, use system default)
  custom_subject TEXT DEFAULT NULL,

  -- Custom body (if NULL, use system default)
  -- Supports placeholders: {{customer_name}}, {{business_name}}, {{service_name}},
  -- {{appointment_date}}, {{appointment_time}}, {{confirmation_code}}, {{staff_name}}
  custom_body TEXT DEFAULT NULL,

  -- For reminder emails: how many hours before appointment
  reminder_hours INTEGER DEFAULT 24,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One template per business + type + locale
  UNIQUE(business_id, template_type, locale)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_booking_email_templates_business
  ON public.booking_email_templates(business_id);

CREATE INDEX IF NOT EXISTS idx_booking_email_templates_lookup
  ON public.booking_email_templates(business_id, template_type, locale);

-- ============================================
-- STEP 4: Enable RLS on booking_email_templates
-- ============================================

ALTER TABLE public.booking_email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own business templates
CREATE POLICY "Users can read own business email templates"
  ON public.booking_email_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_templates.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert templates for their own business
CREATE POLICY "Users can insert own business email templates"
  ON public.booking_email_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_templates.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can update their own business templates
CREATE POLICY "Users can update own business email templates"
  ON public.booking_email_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_templates.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_templates.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete their own business templates
CREATE POLICY "Users can delete own business email templates"
  ON public.booking_email_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_templates.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_email_templates TO authenticated;

-- ============================================
-- STEP 5: Create trigger for auto-updating updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_booking_email_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_email_templates_updated_at_trigger ON public.booking_email_templates;

CREATE TRIGGER booking_email_templates_updated_at_trigger
  BEFORE UPDATE ON public.booking_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_booking_email_templates_updated_at();

-- ============================================
-- STEP 6: Create booking email log table
-- ============================================

-- Track sent booking emails for analytics and debugging
CREATE TABLE IF NOT EXISTS public.booking_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  public_booking_id UUID REFERENCES public.public_bookings(id) ON DELETE SET NULL,

  -- Email details
  template_type TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT DEFAULT NULL,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying email history
CREATE INDEX IF NOT EXISTS idx_booking_email_logs_business
  ON public.booking_email_logs(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_email_logs_booking
  ON public.booking_email_logs(public_booking_id);

-- Enable RLS
ALTER TABLE public.booking_email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own business email logs
CREATE POLICY "Users can read own business email logs"
  ON public.booking_email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_email_logs.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Only system can insert logs (via service role)
CREATE POLICY "System can insert email logs"
  ON public.booking_email_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- Grant permissions
GRANT SELECT ON public.booking_email_logs TO authenticated;
GRANT INSERT ON public.booking_email_logs TO service_role;

-- ============================================
-- STEP 7: Update get_public_booking_config to include branding
-- ============================================

-- Drop the old function first (to handle signature change)
DROP FUNCTION IF EXISTS public.get_public_booking_config(TEXT, TEXT);

-- Recreate with branding fields
CREATE OR REPLACE FUNCTION public.get_public_booking_config(
  p_identifier TEXT,
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business RECORD;
  v_booking_settings RECORD;
  v_services JSONB;
  v_stores JSONB;
  v_staff JSONB;
BEGIN
  -- Find business by slug or public_token
  SELECT
    b.id,
    b.name,
    b.email,
    b.public_booking_token,
    b.booking_slug,
    b.logo_url,
    b.brand_primary_color,
    b.brand_secondary_color,
    b.brand_updated_at
  INTO v_business
  FROM public.businesses b
  WHERE b.booking_slug = p_identifier
     OR b.public_booking_token = p_identifier
  LIMIT 1;

  IF v_business.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Business not found');
  END IF;

  -- Get booking page settings
  SELECT
    bps.enabled_locales,
    bps.default_locale,
    bps.smart_language_detection
  INTO v_booking_settings
  FROM public.booking_page_settings bps
  WHERE bps.business_id = v_business.id;

  -- Default settings if not configured
  IF v_booking_settings IS NULL THEN
    v_booking_settings := ROW(ARRAY['en']::TEXT[], 'en', TRUE);
  END IF;

  -- Get active services
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'description', s.description,
      'color', s.color,
      'duration_minutes', s.duration_minutes,
      'price_cents', s.price_cents,
      'is_active', s.is_active
    )
    ORDER BY s.name
  ), '[]'::jsonb)
  INTO v_services
  FROM public.services s
  WHERE s.business_id = v_business.id
    AND s.is_active = TRUE;

  -- Get non-archived stores
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name
    )
    ORDER BY st.created_at
  ), '[]'::jsonb)
  INTO v_stores
  FROM public.stores st
  WHERE st.business_id = v_business.id
    AND st.is_archived = FALSE;

  -- Get non-archived staff
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'name', sm.full_name,
      'color', sm.color,
      'store_ids', COALESCE((
        SELECT array_agg(ssa.store_id)
        FROM public.staff_store_assignments ssa
        WHERE ssa.staff_id = sm.id
      ), ARRAY[]::UUID[])
    )
    ORDER BY sm.full_name
  ), '[]'::jsonb)
  INTO v_staff
  FROM public.staff_members sm
  WHERE sm.business_id = v_business.id
    AND sm.is_archived = FALSE;

  -- Return complete config
  RETURN jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'email', v_business.email,
      'public_token', v_business.public_booking_token,
      'booking_slug', v_business.booking_slug,
      'logo_url', v_business.logo_url,
      'brand_primary_color', v_business.brand_primary_color,
      'brand_secondary_color', v_business.brand_secondary_color
    ),
    'booking_page_settings', jsonb_build_object(
      'enabled_locales', v_booking_settings.enabled_locales,
      'default_locale', v_booking_settings.default_locale,
      'smart_language_detection', v_booking_settings.smart_language_detection
    ),
    'services', v_services,
    'stores', v_stores,
    'staff', v_staff,
    'requested_locale', p_locale
  );
END;
$$;

-- Grant access to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO anon, authenticated;

-- ============================================
-- STEP 8: Create function to get email template with fallback
-- ============================================

CREATE OR REPLACE FUNCTION public.get_booking_email_template(
  p_business_id UUID,
  p_template_type TEXT,
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_business RECORD;
  v_default_subject TEXT;
  v_default_body TEXT;
BEGIN
  -- Get business info for branding
  SELECT
    name,
    logo_url,
    brand_primary_color,
    brand_secondary_color,
    business_address,
    business_phone_number
  INTO v_business
  FROM public.businesses
  WHERE id = p_business_id;

  IF v_business IS NULL THEN
    RETURN jsonb_build_object('error', 'Business not found');
  END IF;

  -- Try to get custom template for this locale
  SELECT *
  INTO v_template
  FROM public.booking_email_templates
  WHERE business_id = p_business_id
    AND template_type = p_template_type
    AND locale = p_locale;

  -- If not found, try English fallback
  IF v_template IS NULL AND p_locale != 'en' THEN
    SELECT *
    INTO v_template
    FROM public.booking_email_templates
    WHERE business_id = p_business_id
      AND template_type = p_template_type
      AND locale = 'en';
  END IF;

  -- Set default templates based on type
  CASE p_template_type
    WHEN 'confirmation' THEN
      v_default_subject := 'Your appointment is confirmed - {{business_name}}';
      v_default_body := 'Hi {{customer_name}},

Your appointment has been confirmed!

Details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

We look forward to seeing you!

Best regards,
{{business_name}}';

    WHEN 'cancellation' THEN
      v_default_subject := 'Your appointment has been cancelled - {{business_name}}';
      v_default_body := 'Hi {{customer_name}},

Your appointment has been cancelled.

Cancelled appointment:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}

If you did not request this cancellation, please contact us.

Best regards,
{{business_name}}';

    WHEN 'rescheduled' THEN
      v_default_subject := 'Your appointment has been rescheduled - {{business_name}}';
      v_default_body := 'Hi {{customer_name}},

Your appointment has been rescheduled.

New appointment details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

If you have any questions, please contact us.

Best regards,
{{business_name}}';

    WHEN 'reminder' THEN
      v_default_subject := 'Reminder: Your appointment tomorrow - {{business_name}}';
      v_default_body := 'Hi {{customer_name}},

This is a friendly reminder about your upcoming appointment.

Details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

We look forward to seeing you!

Best regards,
{{business_name}}';

    ELSE
      v_default_subject := 'Notification from {{business_name}}';
      v_default_body := 'Hi {{customer_name}},

Thank you for using our services.

Best regards,
{{business_name}}';
  END CASE;

  -- Return template with business branding
  RETURN jsonb_build_object(
    'template_type', p_template_type,
    'locale', p_locale,
    'is_enabled', COALESCE(v_template.is_enabled, TRUE),
    'subject', COALESCE(v_template.custom_subject, v_default_subject),
    'body', COALESCE(v_template.custom_body, v_default_body),
    'reminder_hours', COALESCE(v_template.reminder_hours, 24),
    'is_custom', v_template IS NOT NULL,
    'branding', jsonb_build_object(
      'business_name', v_business.name,
      'logo_url', v_business.logo_url,
      'primary_color', v_business.brand_primary_color,
      'secondary_color', v_business.brand_secondary_color,
      'address', v_business.business_address,
      'phone', v_business.business_phone_number
    )
  );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_booking_email_template(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ============================================
-- STEP 9: Storage bucket setup
-- ============================================

-- NOTE: Run this SQL to create the business-logos storage bucket.
-- This creates the bucket and sets up the necessary policies for logo uploads.

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Storage path structure:
-- business-logos/{business_id}/original.{ext}
-- business-logos/{business_id}/logo_512.png
-- business-logos/{business_id}/logo_256.png
-- business-logos/{business_id}/logo_128.png

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Business owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update logos" ON storage.objects;

-- Create permissive upload policy (allows any authenticated user to upload)
-- This is needed because the backend uses anon key, not user auth
CREATE POLICY "Anyone can upload logos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'business-logos');

-- Create permissive update policy
CREATE POLICY "Anyone can update logos"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'business-logos')
WITH CHECK (bucket_id = 'business-logos');

-- Allow public read access
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'business-logos');

-- ============================================
-- STEP 10: Add indexes for performance
-- ============================================

-- Index on businesses slug for fast public lookups
CREATE INDEX IF NOT EXISTS idx_businesses_booking_slug
  ON public.businesses(booking_slug)
  WHERE booking_slug IS NOT NULL;

-- Index on businesses public_booking_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_businesses_public_booking_token
  ON public.businesses(public_booking_token)
  WHERE public_booking_token IS NOT NULL;

-- ============================================
-- MIGRATION COMPLETE - SUMMARY
-- ============================================
--
-- Changes to businesses table:
--   - logo_path: Path in Supabase Storage
--   - logo_url: Cached public URL
--   - brand_primary_color: Primary brand color (default teal)
--   - brand_secondary_color: Optional secondary color
--   - brand_updated_at: Auto-updated timestamp
--
-- New tables:
--   - booking_email_templates: Custom email templates per business
--   - booking_email_logs: Email delivery tracking
--
-- New/updated functions:
--   - get_public_booking_config: Now includes branding info
--   - get_booking_email_template: Get template with fallback to defaults
--
-- To complete setup:
--   1. Create 'business-logos' storage bucket in Supabase dashboard
--   2. Configure storage policies as shown above
-- ============================================
