/**
 * Booking Email Templates Service
 *
 * Manages booking email templates for the business:
 * - CRUD operations for custom templates
 * - Preview templates with placeholders
 * - Toggle template enabled/disabled
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export type EmailTemplateType = 'confirmation' | 'cancellation' | 'rescheduled' | 'reminder';

export interface EmailTemplate {
  id: string;
  business_id: string;
  template_type: EmailTemplateType;
  locale: string;
  is_enabled: boolean;
  custom_subject: string | null;
  custom_body: string | null;
  reminder_hours: number;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateUpdate {
  is_enabled?: boolean;
  custom_subject?: string | null;
  custom_body?: string | null;
  reminder_hours?: number;
}

export interface TemplateResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Default Templates
// ============================================

export const DEFAULT_TEMPLATES: Record<EmailTemplateType, { subject: string; body: string }> = {
  confirmation: {
    subject: 'Your appointment is confirmed - {{business_name}}',
    body: `Hi {{customer_name}},

Your appointment has been confirmed!

Details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

We look forward to seeing you!

Best regards,
{{business_name}}`,
  },
  cancellation: {
    subject: 'Your appointment has been cancelled - {{business_name}}',
    body: `Hi {{customer_name}},

Your appointment has been cancelled.

Cancelled appointment:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}

If you did not request this cancellation, please contact us.

Best regards,
{{business_name}}`,
  },
  rescheduled: {
    subject: 'Your appointment has been rescheduled - {{business_name}}',
    body: `Hi {{customer_name}},

Your appointment has been rescheduled.

New appointment details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

If you have any questions, please contact us.

Best regards,
{{business_name}}`,
  },
  reminder: {
    subject: 'Reminder: Your appointment tomorrow - {{business_name}}',
    body: `Hi {{customer_name}},

This is a friendly reminder about your upcoming appointment.

Details:
- Service: {{service_name}}
- Date: {{appointment_date}}
- Time: {{appointment_time}}
- Confirmation Code: {{confirmation_code}}

We look forward to seeing you!

Best regards,
{{business_name}}`,
  },
};

// Available placeholders for templates
export const TEMPLATE_PLACEHOLDERS = [
  { key: '{{customer_name}}', description: "Customer's name" },
  { key: '{{business_name}}', description: 'Business name' },
  { key: '{{service_name}}', description: 'Service name' },
  { key: '{{staff_name}}', description: 'Staff member name' },
  { key: '{{appointment_date}}', description: 'Appointment date' },
  { key: '{{appointment_time}}', description: 'Appointment time' },
  { key: '{{confirmation_code}}', description: 'Booking confirmation code' },
  { key: '{{duration_minutes}}', description: 'Appointment duration in minutes' },
];

// ============================================
// Template Operations
// ============================================

/**
 * Get all email templates for a business
 */
export async function getEmailTemplates(
  businessId: string,
  locale: string = 'en'
): Promise<TemplateResult<EmailTemplate[]>> {
  try {
    console.log('[EmailTemplatesService] getEmailTemplates:', { businessId, locale });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('booking_email_templates')
      .select('*')
      .eq('business_id', businessId)
      .eq('locale', locale)
      .order('template_type');

    if (error) {
      console.log('[EmailTemplatesService] Error fetching templates:', error.message);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.log('[EmailTemplatesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch templates'),
    };
  }
}

/**
 * Get a single email template (creates with defaults if doesn't exist)
 */
export async function getEmailTemplate(
  businessId: string,
  templateType: EmailTemplateType,
  locale: string = 'en'
): Promise<TemplateResult<EmailTemplate>> {
  try {
    console.log('[EmailTemplatesService] getEmailTemplate:', { businessId, templateType, locale });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('booking_email_templates')
      .select('*')
      .eq('business_id', businessId)
      .eq('template_type', templateType)
      .eq('locale', locale)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.log('[EmailTemplatesService] Error fetching template:', error.message);
      return { data: null, error };
    }

    // If not found, return a virtual template with defaults
    if (!data) {
      const defaults = DEFAULT_TEMPLATES[templateType];
      return {
        data: {
          id: '',
          business_id: businessId,
          template_type: templateType,
          locale,
          is_enabled: true,
          custom_subject: null,
          custom_body: null,
          reminder_hours: 24,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    return { data, error: null };
  } catch (err) {
    console.log('[EmailTemplatesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch template'),
    };
  }
}

/**
 * Update or create an email template
 */
export async function upsertEmailTemplate(
  businessId: string,
  templateType: EmailTemplateType,
  locale: string,
  updates: EmailTemplateUpdate
): Promise<TemplateResult<EmailTemplate>> {
  try {
    console.log('[EmailTemplatesService] upsertEmailTemplate:', {
      businessId,
      templateType,
      locale,
      updates,
    });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('booking_email_templates')
      .upsert(
        {
          business_id: businessId,
          template_type: templateType,
          locale,
          ...updates,
        },
        {
          onConflict: 'business_id,template_type,locale',
        }
      )
      .select()
      .single();

    if (error) {
      console.log('[EmailTemplatesService] Error upserting template:', error.message);
      return { data: null, error };
    }

    console.log('[EmailTemplatesService] Template upserted successfully');
    return { data, error: null };
  } catch (err) {
    console.log('[EmailTemplatesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update template'),
    };
  }
}

/**
 * Toggle template enabled/disabled
 */
export async function toggleTemplateEnabled(
  businessId: string,
  templateType: EmailTemplateType,
  locale: string,
  enabled: boolean
): Promise<TemplateResult<EmailTemplate>> {
  return upsertEmailTemplate(businessId, templateType, locale, { is_enabled: enabled });
}

/**
 * Reset template to defaults (removes custom subject/body)
 */
export async function resetTemplateToDefaults(
  businessId: string,
  templateType: EmailTemplateType,
  locale: string
): Promise<TemplateResult<EmailTemplate>> {
  return upsertEmailTemplate(businessId, templateType, locale, {
    custom_subject: null,
    custom_body: null,
  });
}

/**
 * Delete a custom template (reverts to system defaults)
 */
export async function deleteEmailTemplate(
  businessId: string,
  templateType: EmailTemplateType,
  locale: string
): Promise<TemplateResult<boolean>> {
  try {
    console.log('[EmailTemplatesService] deleteEmailTemplate:', {
      businessId,
      templateType,
      locale,
    });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { error } = await getSupabase()
      .from('booking_email_templates')
      .delete()
      .eq('business_id', businessId)
      .eq('template_type', templateType)
      .eq('locale', locale);

    if (error) {
      console.log('[EmailTemplatesService] Error deleting template:', error.message);
      return { data: null, error };
    }

    console.log('[EmailTemplatesService] Template deleted successfully');
    return { data: true, error: null };
  } catch (err) {
    console.log('[EmailTemplatesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete template'),
    };
  }
}

// ============================================
// Preview Helpers
// ============================================

/**
 * Replace placeholders with sample data for preview
 */
export function previewTemplate(
  template: string,
  businessName: string
): string {
  return template
    .replace(/\{\{customer_name\}\}/g, 'John Doe')
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{service_name\}\}/g, 'Haircut')
    .replace(/\{\{staff_name\}\}/g, 'Jane Smith')
    .replace(/\{\{appointment_date\}\}/g, 'Monday, January 15, 2024')
    .replace(/\{\{appointment_time\}\}/g, '2:00 PM')
    .replace(/\{\{confirmation_code\}\}/g, 'ABC123')
    .replace(/\{\{duration_minutes\}\}/g, '60');
}

/**
 * Get effective subject (custom or default)
 */
export function getEffectiveSubject(
  template: EmailTemplate | null,
  templateType: EmailTemplateType
): string {
  if (template?.custom_subject) {
    return template.custom_subject;
  }
  return DEFAULT_TEMPLATES[templateType].subject;
}

/**
 * Get effective body (custom or default)
 */
export function getEffectiveBody(
  template: EmailTemplate | null,
  templateType: EmailTemplateType
): string {
  if (template?.custom_body) {
    return template.custom_body;
  }
  return DEFAULT_TEMPLATES[templateType].body;
}
