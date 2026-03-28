/**
 * CAN-SPAM Compliant Email Service
 *
 * This service enforces mandatory email compliance rules that CANNOT be
 * disabled, edited, or bypassed by business users.
 *
 * Compliance Features:
 * 1. Automatic unsubscribe footer injection on ALL commercial emails
 * 2. Opt-out status check before EVERY email send
 * 3. One-click unsubscribe processing (no login/password required)
 * 4. Business-level isolation (opt-out from Business A doesn't affect Business B)
 * 5. Audit logging for all opt-out/opt-in events
 * 6. EU GDPR compliance footer extension for EU recipients (additive)
 *
 * Legal Compliance:
 * - U.S. CAN-SPAM Act
 * - Florida Electronic Communications Regulations
 * - EU GDPR (Article 21 - Right to Object) - via unsubscribe system
 * - ePrivacy Directive - via unsubscribe system
 */

import { useStore } from './store';
import {
  EmailSendRequest,
  EmailSendResult,
  BulkEmailSendResult,
  EmailAttachment,
  CountryCode,
  Language,
} from './types';
import { EU_RECIPIENT_FOOTER_LINE } from './legal-content';
import { generateEmailFooter } from './country-legal-compliance';

// ============================================
// SYSTEM-ENFORCED CONSTANTS - CANNOT BE MODIFIED
// ============================================

/**
 * Mandatory unsubscribe footer - automatically appended to ALL commercial emails
 * This text CANNOT be edited, hidden, or removed by business users
 */
const MANDATORY_UNSUBSCRIBE_FOOTER = `

---
You are receiving this email because you are a customer of {{businessName}}.

To stop receiving emails from {{businessName}}, click here to unsubscribe:
{{unsubscribeUrl}}

This unsubscribe link will remain active for at least 30 days.
`;

/**
 * EU-specific footer extension - appended for EU recipients only
 * Subtle, non-intrusive, same styling as existing footer
 * Satisfies GDPR Article 21 and ePrivacy Directive requirements
 */
const EU_FOOTER_EXTENSION = `
${EU_RECIPIENT_FOOTER_LINE}
`;

/**
 * Generate a unique unsubscribe URL for one-click opt-out
 * The URL encodes the recipient email and business ID
 */
export function generateUnsubscribeUrl(
  recipientEmail: string,
  businessId: string,
  baseUrl: string = 'https://app.example.com'
): string {
  // In production, this would be a signed/encrypted token
  const token = btoa(JSON.stringify({
    email: recipientEmail.toLowerCase().trim(),
    businessId,
    timestamp: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days validity
  }));
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Parse unsubscribe token from URL
 */
export function parseUnsubscribeToken(token: string): {
  email: string;
  businessId: string;
  timestamp: number;
  expiresAt: number;
} | null {
  try {
    const decoded = JSON.parse(atob(decodeURIComponent(token)));
    if (decoded.email && decoded.businessId && decoded.expiresAt) {
      // Check if token is still valid (30 days from creation)
      if (Date.now() <= decoded.expiresAt) {
        return decoded;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inject mandatory unsubscribe footer into email body
 * This is a SYSTEM-ENFORCED function that cannot be bypassed
 * Uses dynamic footer based on country/state/language settings
 * @param isEuRecipient - If true, appends subtle EU GDPR footer line
 */
function injectUnsubscribeFooter(
  emailBody: string,
  businessName: string,
  businessAddress: string,
  unsubscribeUrl: string,
  countryCode: CountryCode | undefined,
  stateCode: string | undefined,
  footerLanguage: Language,
  isEuRecipient: boolean = false,
  businessPhoneNumber?: string
): string {
  // Use dynamic footer generation based on country/state/language
  let footer = generateEmailFooter(
    businessName,
    businessAddress,
    countryCode,
    stateCode,
    footerLanguage,
    unsubscribeUrl,
    businessPhoneNumber
  );

  // Add EU-specific footer extension if recipient is in EU
  // This is subtle and non-intrusive per ePrivacy requirements
  if (isEuRecipient) {
    footer += EU_FOOTER_EXTENSION;
  }

  return emailBody + footer;
}

/**
 * Email Service Class
 *
 * All email sending MUST go through this service to ensure CAN-SPAM compliance.
 * Business users cannot bypass this service.
 */
export class EmailService {
  private static instance: EmailService;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send a single email with mandatory compliance checks
   *
   * This method:
   * 1. Checks opt-out status BEFORE sending
   * 2. Injects mandatory unsubscribe footer
   * 3. Creates opt-out record if none exists (soft opt-in)
   * 4. Adds EU GDPR footer extension for EU recipients (if isEuRecipient is true)
   */
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    const store = useStore.getState();
    const normalizedEmail = request.recipientEmail.toLowerCase().trim();

    // COMPLIANCE CHECK 1: Check opt-out status BEFORE sending
    const isOptedOut = store.getOptOutStatus(normalizedEmail, request.businessId);

    if (isOptedOut) {
      console.log(`[EmailService] BLOCKED: ${normalizedEmail} has opted out from ${request.businessId}`);
      return {
        success: false,
        recipientEmail: normalizedEmail,
        error: 'Recipient has opted out of emails from this business',
        blockedByOptOut: true,
      };
    }

    // COMPLIANCE CHECK 2: Create opt-out record if none exists (soft opt-in)
    const existingRecord = store.getOptOutRecord(normalizedEmail, request.businessId);
    if (!existingRecord) {
      store._systemCreateOptOutRecord(normalizedEmail, request.businessId, 'client_creation');
    }

    // COMPLIANCE CHECK 3: Generate unsubscribe URL and inject footer
    // For EU recipients, also includes the EU GDPR footer extension (subtle, non-intrusive)
    const unsubscribeUrl = generateUnsubscribeUrl(normalizedEmail, request.businessId);
    const compliantBody = injectUnsubscribeFooter(
      request.body,
      request.businessName,
      request.businessAddress || '',
      unsubscribeUrl,
      request.businessCountry,
      request.businessState,
      request.emailFooterLanguage || 'en',
      request.isEuRecipient ?? false,
      request.businessPhoneNumber
    );

    // In production, this would call an actual email API (SendGrid, AWS SES, etc.)
    // For now, we simulate the send
    try {
      console.log(`[EmailService] Sending email to ${normalizedEmail}${request.isEuRecipient ? ' (EU recipient)' : ''}`);
      console.log(`[EmailService] Subject: ${request.subject}`);
      console.log(`[EmailService] Body with compliance footer:`, compliantBody);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        success: true,
        recipientEmail: normalizedEmail,
      };
    } catch (error) {
      return {
        success: false,
        recipientEmail: normalizedEmail,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk emails with mandatory compliance checks
   *
   * Automatically filters out opted-out recipients
   */
  async sendBulkEmail(
    requests: EmailSendRequest[]
  ): Promise<BulkEmailSendResult> {
    const results: EmailSendResult[] = [];
    let sent = 0;
    let blocked = 0;
    let failed = 0;

    for (const request of requests) {
      const result = await this.sendEmail(request);
      results.push(result);

      if (result.success) {
        sent++;
      } else if (result.blockedByOptOut) {
        blocked++;
      } else {
        failed++;
      }
    }

    return {
      totalRequested: requests.length,
      sent,
      blocked,
      failed,
      results,
    };
  }

  /**
   * Process one-click unsubscribe from email link
   *
   * This is called when a user clicks the unsubscribe link in an email.
   * NO login, password, or confirmation required (CAN-SPAM compliant).
   */
  processUnsubscribe(token: string): {
    success: boolean;
    message: string;
    email?: string;
  } {
    const parsed = parseUnsubscribeToken(token);

    if (!parsed) {
      return {
        success: false,
        message: 'Invalid or expired unsubscribe link. Please contact support.',
      };
    }

    const store = useStore.getState();
    store._systemProcessOptOut(parsed.email, parsed.businessId);

    return {
      success: true,
      message: 'You have been successfully unsubscribed. You will no longer receive emails from this business.',
      email: parsed.email,
    };
  }

  /**
   * Process manual re-subscribe request
   *
   * This requires EXPLICIT user action and cannot be done automatically.
   */
  processResubscribe(
    recipientEmail: string,
    businessId: string
  ): { success: boolean; message: string } {
    const store = useStore.getState();
    const normalizedEmail = recipientEmail.toLowerCase().trim();

    const record = store.getOptOutRecord(normalizedEmail, businessId);

    if (!record) {
      return {
        success: false,
        message: 'No subscription record found for this email.',
      };
    }

    if (!record.emailOptOut) {
      return {
        success: false,
        message: 'You are already subscribed to emails from this business.',
      };
    }

    store._systemProcessResubscribe(normalizedEmail, businessId);

    return {
      success: true,
      message: 'You have been successfully re-subscribed. You will now receive emails from this business.',
    };
  }

  /**
   * Get list of recipients who have opted out
   * Used for displaying blocked recipients in UI
   */
  getOptedOutRecipients(businessId: string): string[] {
    const store = useStore.getState();
    return store.emailOptOuts
      .filter((r) => r.businessId === businessId && r.emailOptOut)
      .map((r) => r.recipientEmail);
  }

  /**
   * Filter out opted-out recipients from a list
   * Used before bulk email sends
   */
  filterOptedOutRecipients(
    emails: string[],
    businessId: string
  ): { allowed: string[]; blocked: string[] } {
    const store = useStore.getState();
    const allowed: string[] = [];
    const blocked: string[] = [];

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase().trim();
      const isOptedOut = store.getOptOutStatus(normalizedEmail, businessId);

      if (isOptedOut) {
        blocked.push(normalizedEmail);
      } else {
        allowed.push(normalizedEmail);
      }
    }

    return { allowed, blocked };
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();

/**
 * Hook for using email service in React components
 */
export function useEmailService() {
  return emailService;
}
