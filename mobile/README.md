# ClientFlow - Customer Management App

A beautiful, mobile-first customer management app for small service businesses (barbershops, salons, spas, nail techs).

## Recent Changes

### P0 Crash Fix — Business Setup modal transition guard (2026-03-20)

#### Root Cause
iOS `pageSheet` modals animate their dismiss over ~350 ms. When a user closed one modal and tapped a step immediately, React Native tried to present the next `pageSheet` modal before UIKit finished dismissing the previous one. UIKit threw a "not in window hierarchy" exception, crashing the app back to the dashboard.

#### Files Modified
- `mobile/src/app/business-setup.tsx` — Added `transitionLockRef` (500 ms guard) in `close()` to block `handleStepPress` while the previous modal is still animating its dismiss. Added `useEffect` cleanup on unmount. Added defensive console logs throughout.
- `mobile/src/components/HighlightWrapper.tsx` — Wrapped Reanimated `withSequence`/`withTiming` calls in `try/catch` so any animation worklet error fails silently instead of crashing the host screen.

#### What Did NOT Change
- All 8 direct-navigation modal targets remain intact (no routing through generic Settings)
- 18-language SetupHint/hint copy behavior untouched
- No new features, no new steps, no screen refactors
- Highlight/scroll behavior preserved; only made fail-open



### Client Details → Appointments: View/Edit now reuses exact main Appointments flow (2026-03-17)

#### File Modified
- `mobile/src/components/clientDetail/VisitsModal.tsx`

#### What Changed
- **View Appointment header** now matches AppointmentsScreen exactly: `[CalendarDays icon+circle | title (flex 1)] [X close]` — removed back-button-centered layout
- **Edit Appointment header** now matches AppointmentsScreen exactly: `[← ArrowLeft | CalendarClock | "Edit Appointment" (flex 1)] [X close]` — replaced Cancel/Save nav-bar style
- **Save button** moved from header to bottom of edit form (same position as AppointmentsScreen)
- **Client section** added to View Appointment (section 3, same as main flow)
- **Repeat/Recurring section** added to View Appointment (section 4, same as main flow)
- **Duration section** added to View Appointment (section 9, same as main flow)
- **Gift Card section** added to View Appointment with full live data (same as main flow): redemption transaction, value card debit/balance rows, service card deduct/remaining rows
- **Live data hooks** added: `useClientGiftCards` + `useGiftCardRedemptionByAppointment` — auto-refetch when viewed appointment changes
- **Edit button rule** fixed: now uses `!isTerminal` (completed/no_show/cancelled all hide Edit), matching AppointmentsScreen exactly
- **Section order** now matches AppointmentsScreen: Status → Code → Client → Repeat → Date → Time → Staff → Services → Duration → Store → Promotion → Loyalty → Gift Card → Amount → Notes → Edit CTA

### BUGATTI SECURITY PHASE 4C — Distributed Rate Limiting (2026-03-07)

#### Files Created
- `backend/supabase/migrations/20260307200000_add_distributed_rate_limit_counters.sql` — persistent rate limit counters table + atomic RPC
- `backend/src/lib/distributedRateLimit.ts` — reusable distributed rate limit helper

#### Files Modified
- `backend/src/index.ts` — upgraded booking lookup, check-duplicate, and bulk email middleware to use distributed limiter; added startup auto-apply
- `backend/src/routes/aiContent.ts` — added distributed rate limiting to all 3 AI endpoints

#### What Changed

**Storage backend: Supabase (`public.rate_limit_counters`)**
- No Redis required — uses Supabase service role for persistent, cross-process counters
- Atomic `rate_limit_increment` RPC handles window expiry and counter reset in a single upsert
- RLS enabled — no public read/write access

**New `backend/src/lib/distributedRateLimit.ts` helper:**
- `checkDistributedRateLimit(options)` — async, fail-open, returns `{ limited, count, max, backend }`
- `distributedRateLimitMiddleware(...)` — Hono middleware factory for static-key routes
- `getClientIp(c)` — safe IP extraction from forwarded headers
- Fallback: if Supabase RPC fails, falls back to per-process in-memory Map (same as before)
- If even in-memory fails: logs error and allows the request (`error_passthrough`)

**Routes now using distributed rate limiting:**

| Route | Limiter Name | Key | Window | Max |
|-------|-------------|-----|--------|-----|
| POST /api/bulk-email/send | `bulk_email` | `businessId:userId` | 60s | 10 sends |
| GET /api/booking/lookup/* | `booking_lookup` | `ip` | 60s | 10 req |
| GET /api/booking/confirmation-pdf/* | `booking_lookup` | `ip` | 60s | 10 req |
| GET /api/booking/share-pdf/* | `booking_lookup` | `ip` | 60s | 10 req |
| POST /api/booking/check-duplicate | `check_duplicate` | `ip:businessId` | 60s | 20 req |
| POST /api/ai-content/generate | `ai_generate` | `ip` | 60s | 20 req |
| POST /api/ai-content/advise | `ai_advise` | `ip` | 60s | 15 req |
| POST /api/ai-content/prepare-campaign | `ai_prepare_campaign` | `ip` | 60s | 15 req |

**Fallback behavior:**
- Supabase unavailable → falls back to in-memory per-process Map (same behavior as before Phase 4C)
- Existing in-memory Maps (`bookingLookupCounts`, `checkDuplicateCounts`) kept and passed as `fallbackMap` so no protection gap during fallback
- `error_passthrough` backend: catastrophic fallback failure → request allowed (fail-open)

**Safety confirmations:**
- Frontend payloads unchanged
- Response shapes unchanged — 429 responses use the same `{ error: "Too many requests..." }` format
- All existing flows (CRM, appointments, gift cards, loyalty, memberships) untouched



#### Files Created
- `backend/supabase/migrations/20260307100000_add_system_audit_log.sql` — migration for central audit table
- `backend/src/lib/auditLog.ts` — reusable audit logging helper

#### Files Modified
- `backend/src/routes/giftCards.ts` — audit on gift card issuance
- `backend/src/routes/appointments.ts` — audit on gift card debit, loyalty points award, appointment completion/outcome
- `backend/src/routes/promotionAssignments.ts` — audit on assign, pause, resume, remove
- `backend/src/routes/promotionCounters.ts` — audit on counter creation and redemption
- `backend/src/lib/membershipScheduler.ts` — audit on membership auto-expiration
- `backend/src/index.ts` — startup auto-apply of audit log migration

#### What Changed

**New `public.system_audit_log` table:**
- Append-only audit table with RLS enabled — no public read/write access
- Fields: `id`, `created_at`, `business_id`, `actor_user_id`, `actor_type`, `entity_type`, `entity_id`, `event_type`, `source`, `metadata` (JSONB)
- Indexed on `business_id`, `(entity_type, entity_id)`, `event_type`, `created_at`
- Auto-applied on startup via Supabase Management API

**New `backend/src/lib/auditLog.ts` helper:**
- `logAuditEvent(input)` — async, fail-open (never throws, never blocks user-facing flows)
- `logAuditEventFireAndForget(input)` — fire-and-forget variant for zero latency paths
- Typed `AuditActorType`, `AuditEntityType`, `AuditEventType` enums

**Events now audited:**

| Event | Entity Type | Trigger |
|-------|-------------|---------|
| `gift_card.issued` | gift_card | POST /api/gift-cards/issue |
| `gift_card.debited` (value) | gift_card | Appointment completion with value gift card |
| `gift_card.debited` (service) | gift_card | Appointment completion with service gift card |
| `loyalty.points_awarded` | loyalty | Appointment completion for enrolled clients |
| `appointment.completed_with_gift_card` | appointment | POST /api/appointments/complete |
| `appointment.outcome_set` | appointment | POST /api/appointments/outcome |
| `promotion_assignment.assigned` | promotion_assignment | POST /api/promotion-assignments/assign |
| `promotion_assignment.paused` | promotion_assignment | POST /api/promotion-assignments/pause |
| `promotion_assignment.resumed` | promotion_assignment | POST /api/promotion-assignments/resume |
| `promotion_assignment.removed` | promotion_assignment | POST /api/promotion-assignments/remove |
| `promotion_counter.created` | promotion_counter | POST /api/promotion-counters |
| `promotion_counter.redemption_added` | promotion_counter | POST /api/promotion-counters/:id/redemptions |
| `membership.cancelled` | membership | Scheduler auto-expiration |

**Metadata captured per event (examples):**
- Gift card: `code`, `type`, `amount`, `currency`, `client_id`, `balance_before`, `balance_after`, `is_fully_used`
- Loyalty: `points_delta`, `points_before`, `points_after`, `lifetime_points_after`, `revenue_amount`, `appointment_id`
- Promotion: `client_id`, `promotion_id`, `action`, `previous_status`
- Membership: `client_id`, `plan_id`, `previous_status`, `new_status`, `days_past_grace`

**Safety guarantees:**
- Frontend payloads did NOT change
- Response shapes did NOT change
- All audit calls are fire-and-forget or fail-open — user-facing flows never blocked
- No secrets, tokens, or payment credentials are logged



#### Files Created
- `backend/src/lib/tenantContext.ts` — new dedicated tenant context module

#### Files Modified
- `backend/src/routes/dripCampaigns.ts`
- `backend/src/routes/promotionAssignments.ts`
- `backend/src/routes/promotionCounters.ts`
- `backend/src/routes/bulkEmail.ts`
- `backend/src/routes/transactional.ts`

#### What Changed

**New `tenantContext.ts` helper:**
- Re-exports `resolveTenantContext`, `requireAuth`, `verifyBusinessOwnership`, `TenantContext` from `auth.ts` for single-import convenience
- Adds `getTenantContext(c)` — resolves ALL businesses owned by the authenticated user, returning `{ userId, ownedBusinessIds, primaryBusinessId }`
- Adds `assertTenantOwns(tenant, businessId)` — checks a specific businessId is in the verified owned set
- Fails closed: if admin client is unavailable, returns 401 (never allows through)

**Routes migrated to `resolveTenantContext`:**

All 19 call sites across 5 routes now use `resolveTenantContext(c, businessId)` instead of the manual two-step pattern. The helper validates Bearer token + ownership in one call and returns a typed discriminated union.

| Route | Endpoints migrated |
|---|---|
| dripCampaigns.ts | GET /, POST /, POST /enroll-client, POST /unenroll-client, GET /enrollments, GET /sends |
| promotionAssignments.ts | GET /, POST /assign, POST /pause, POST /resume, POST /remove |
| promotionCounters.ts | GET /, POST /, POST /:counterId/redemptions |
| bulkEmail.ts | POST /send |
| transactional.ts | POST /notify, GET /settings/:businessId, PUT /settings/:businessId |

**Routes intentionally left unchanged:**
- `appointments.ts` — derives `business_id` from DB record (Pattern B, already safe)
- `clients.ts` — resolves `business_id` from client record (Pattern B, already safe)
- `storage.ts` — complex multi-part form handling with derived ownership
- `giftCards.ts` — uses direct `owner_id` query (equivalent pattern)
- `promotions.ts` — relies on Supabase RLS policies
- `booking.ts`, `bookingPage.ts`, `calendar.ts` — intentionally public (no auth)
- `promotionCounters.ts` GET/PATCH/DELETE on individual resources — auth-only, no direct business_id in scope
- `admin.ts`, `migrations.ts`, `sample.ts` — system/service-role routes, not subject to tenant context

**Security guarantee:**
- No route trusts raw `business_id` from client input without verification
- `ctx.businessId` (the DB-verified value) is used for all DB writes after auth
- No frontend request or response payloads changed
- No production behavior changed

### Global Email System Fix (2026-03-06)

#### Files: `backend/src/lib/email.ts`, `backend/src/routes/bulkEmail.ts`

**Calendar Buttons:**
- Calendar "Add to Calendar" section now only appears in appointment emails (confirmation, rescheduled, update)
- Removed calendar buttons from cancellation emails — they are not appropriate when an appointment is cancelled

**Dynamic Store Footer Layout:**
- 1 store: single centered block
- 2 stores: two equal 50% columns side by side
- 3 stores: three equal columns (33% each) with reduced inter-column padding (8px instead of 14px) to prevent text wrapping in narrow columns

**Social Icons:**
- All 7 social platform icons (Instagram, Facebook, TikTok, YouTube, WhatsApp, LinkedIn, Website) use Icons8 CDN white-on-circle design
- 40×40 colored circle background using business primary color
- 24×24 white platform logo centered inside

**System scope:** All email types use the same shared layout — appointment, gift card, loyalty, membership, bulk marketing, drip campaigns, transactional notifications

### Share Promotion Feature (2026-03-04)

#### Location: Promotions → Active Promotions → Promotion Details (Edit modal)

New **Share Promotion** button added under the existing actions in the edit modal.

**`SharePromotionModal` component** (`src/components/SharePromotionModal.tsx`):
- Auto-generates a default caption using promotion name, description, business name, and a dynamically resolved link
- Caption is fully editable inside a multiline `TextInput` before sharing
- **Reset** button restores the default caption at any time
- **Link source logic** (auto-resolved):
  1. If Booking Page is enabled (`featureToggles.calendarEnabled`) → uses the Booking Page URL
  2. If Booking is disabled → fetches `social_links.website` or `social_links.custom` from `bookingPageSettingsService`
  3. If no link is configured → shows a yellow notice to the user
- Link source badge shown in UI (Booking Page vs Business Website)
- **Preview** button → opens an inline `PreviewScreen` showing promotion title, description, caption, link, and business name
- **Copy Text** button → copies caption to clipboard (green checkmark feedback)
- **Share** button → writes caption to a temp `.txt` file, opens native OS share sheet (Instagram, WhatsApp, Messages, Facebook, TikTok, Email, etc.)
- Fully frontend-only; no backend changes, no DB schema changes

### Staff Calendar Smart Export + Staff Email Field (2026-03-03)

#### A) Staff Profile — Section Order Swapped
- **Hours Distribution** is now displayed **above** Shift History
- **Shift History** is now displayed **below** Hours Distribution
- All data and styling preserved, purely a visual re-ordering

#### B) Staff Calendar — Smart Export Bottom Sheet
Replaced the simple 4-button share modal with a full-featured smart export bottom sheet:
- **Scope selector**: Store Schedule (entire store) vs Staff Schedule (individual)
- **Store selector**: Dropdown of all active stores (shown when Store Schedule is selected)
- **Staff selector**: Dropdown of all staff with avatars and email preview (shown when Staff Schedule is selected)
- **Date range**: Quick-select chips (This Week / 2 Weeks / This Month) + current range display
- **Output format**: PDF | Email | Share (3-way segmented control)
- **Email delivery**: Text input for custom email; if Staff Schedule selected and staff has email, quick "Use staff email" pill appears
- **PDF generation**: Enterprise-grade HTML PDF with store name, date range, staff avatars, shift table, primary color accents, generated timestamp
- **Progress indicator**: ActivityIndicator shown during export
- All labels fully localized in 18 languages

#### C) Add Staff + Edit Staff — Email Field
- New **Email** field added directly under Name in both Add Staff and Edit Staff modals
- Field label: "Email" (localized, 18 languages)
- Placeholder: `name@email.com`
- Inline validation: red error message for invalid email format
- Helper text: "This email is used to send staff schedules." (localized, 18 languages)
- Email is saved with staff member and used in Smart Export for quick delivery
- Empty email = only custom email option shown in export modal

#### D) Translations — 18 Languages
New translation keys added to all 18 languages:
- `storeSchedule`, `staffScheduleOption`, `exportScope`, `dateRange`, `outputFormat`
- `exportButtonLabel`, `sendToEmail`, `useStaffEmail`
- `staffEmailFieldLabel`, `staffEmailHelperText`
- `generatedOn`



Complete overhaul of `StaffCalendarScreen.tsx`:

1. **Shift blocks — names only, no clipping** — Removed all time text from inside shift blocks. Each block shows ONLY the staff first name. The vertical time axis already communicates timing; duplicating it caused clipping. Accent bar on left edge preserved.
2. **Dynamic time range** — Grid starts at the EXACT earliest shift hour (no buffer before), ends at latest shift end +1h. Adjusts live when staff filter changes. Falls back to 9a–6p if no shifts.
3. **Staff filtering fixed for all staff** — Filter uses `staff_id` (UUID) comparison throughout, not name strings. John/Austin/Alice all filter identically.
4. **Staff Picker bottom sheet** — Horizontal chip row completely removed (doesn't scale). Replaced with a single compact "Staff Selector" button in toolbar that opens a full bottom sheet with search field, avatar list, "All Staff" at top, single-select + "Clear". Scales to 100+ staff.
5. **Compact icon toolbar** — Redesigned toolbar row: View toggle | separator | Copy (icon) | Auto (icon+label) | Staff Selector (fills flex) | Share (icon). No button is clipped on iPhone screens.
6. **Auto-Schedule modal** — Preserved exactly as-is (no changes to logic or UI).
7. **Share/Export** — Preserved exactly as-is (PDF, CSV, Text, Print).

### Store Image Upload Fix for Store #2/#3 (2026-02-28)

#### Bug Fixed: Store image upload fails for Store #2 and Store #3

**Fixes applied:**

1. **`openEditStoreModal` state reset** — `storePhotoUploadError` and `isUploadingStorePhoto` were not reset when opening the edit modal for a different store. If a previous upload attempt had failed, the stale error state could affect subsequent stores. Now all photo state is explicitly reset before loading the new store.

2. **Upload retry with exponential backoff** — `uploadToBackendWithRetry()` retries up to 3 times (with 1s/2s delay) on transient server/network errors. Client errors (file too large, wrong format) are not retried.

3. **Better error specificity** — Backend now includes the exact failure step and error details in the response body. Frontend shows the actual error string for server/unknown errors so users can report meaningful diagnostics.

4. **Fixed error message ordering in `mapBackendError`** — 502 Storage errors were previously matched by the `>= 500` catch-all before the specific 502 check. Now Storage errors show "Upload failed (Storage error)" and server errors show "Upload failed (Server error) [details]".

5. **Comprehensive backend logging** — Every upload now logs `storeId`, `businessId`, each step, and exact failure reason — including the EXCEPTION stack when a 500 occurs.

### Store Image Upload Fix (2026-02-28)

#### Bug Fixed: "Upload failed" error in Edit Store → Change Image

**Root causes identified and fixed in `storePhotoService.ts`:**

1. **Web (Expo Web) URI validation was broken** — Expo Web image picker returns `data:image/jpeg;base64,...` URIs. The old `getFileExtension()` found no `.jpg` extension and rejected them as "unsupported file type", causing upload to fail immediately on web.

2. **`FileSystem.getInfoAsync` called on web URIs** — `data:` and `blob:` URIs are not real files; calling `getInfoAsync` on them threw errors or returned `exists: false`, failing validation.

3. **Image compression distorted non-square images** — `resize: { width: 512, height: 512 }` forced both dimensions, stretching portrait/landscape images. Fixed to use `resize: { width: 512 }` (width-only), preserving aspect ratio.

**Fixes applied:**

- `isDataUri()` / `isBlobUri()` helpers detect web URIs and skip file-system operations
- `getMimeFromDataUri()` extracts MIME type directly from `data:` URI prefix for validation
- `getUriFileSize()` handles all URI types: estimates base64 size for `data:` URIs, skips check for `blob:` URIs
- `uploadDataUriToBackend()` converts `data:` URI → Blob via `fetch(dataUri).blob()` and sends as FormData on web
- `mapBackendError()` provides specific user-facing messages for rate limits, file-too-large, corrupt files, server errors, and network errors
- `mapStorePhotoError()` in `StoresManagementScreen.tsx` updated to match new error message patterns

**Error messages are now specific:**
- File too large → "File too large. Maximum size is 10MB."
- Unsupported format → "Unsupported file type. Use JPG, PNG, or WEBP."
- Network error → "Network error. Please check your connection and try again."
- Server error → "Upload failed (Server error) [details]. Please try again."
- Rate limited → "Too many uploads. Please wait a moment and try again."

### Email Footer + Editor Formatting Fix (2026-02-27)

#### Store Footer — Definitive Fix (All Email Types)
- **Root cause fixed**: HTML `nowrap` attribute added to every address `<td>` — this is the only reliable way to prevent line breaks in Outlook, Gmail, and Apple Mail
- `font-size: 10px` on address lines ensures text fits within 33%-wide columns (~185px) without wrapping
- **Inline SVG icons** for pin (📍) and phone (📞) — embedded as data URIs, no external requests, guaranteed delivery
- Icons use the business primary theme color — changes automatically when theme color changes in Settings
- 3-column layout preserved for 3 stores (1 store centered, 2 stores = 2 cols, 3 stores = 3 cols, 4+ stores = 2-col grid)
- State abbreviations kept as-is (FL, NY, etc.)
- Applied globally to: bulk emails (`bulkEmail.ts`) and ALL transactional emails (`email.ts`)

#### Bulk Email Editor — Formatting Controls Fixed
- **Bold/Italic no phantom "text"**: Inserting `**bold**` or `_italic_` when no text is selected now inserts empty markers (`****` / `__`) instead of the word "text"
- **Alignment buttons work**: AlignLeft / AlignCenter / AlignRight now update `textAlign` state and apply `text-align` CSS to rendered HTML paragraphs
- **Italic rendering in HTML**: Backend now converts `_italic_` markdown to `<em>` tags in the final email HTML
- `text_align` field added to the Zod schema and passed through `generateBulkHtmlEmail`

#### Book (Send) Email Editor — Formatting Controls Added
- New formatting toolbar added to `SendEmailModal` (accessed from appointment detail → email client)
- Controls: **Bold**, *Italic*, • Bullets, Align Left, Align Center, Align Right
- All controls work correctly — no phantom text insertion, alignment applies visually and resets on close

#### Store Grid — New Format (ALL Emails)
- Each store card now shows: **Store Name** (bold), 📍 Street (line 1), City/State ZIP (line 2), 📞 Phone
- Icons (📍 📞) use the business primary theme color — updates automatically when theme changes
- State abbreviations auto-expanded to full name (FL → Florida, NY → New York, etc.)
- Phone always formatted as `(XXX) XXX XXXX`
- Duplicate address block below the 3-column grid has been **removed**
- Applied to: bulk emails (`bulkEmail.ts`) and all transactional/booking emails (`email.ts`)

#### Unsubscribe — 404 Fixed
- New backend route: `GET /api/unsubscribe?token=...` (in `index.ts`)
- Validates base64url token (email, businessId, timestamp) with 30-day expiry
- Marks `clients.email_opt_out = true` in database for the matching business
- Returns a clean HTML confirmation page: "You're unsubscribed" with business name
- Invalid/expired tokens → clean error page (not 404)
- Works on mobile Safari and all browsers

#### Dynamic Compliance Footer — By Country
- US → CAN-SPAM compliant text + "Unsubscribe"
- Canada → CASL compliant text + "Unsubscribe / Se désabonner"
- EU/UK → GDPR Article 21 text + "Unsubscribe (GDPR opt-out)"
- Other countries → generic unsubscribe text
- Reads `business_country` from Settings → Business Information
- Single compliance block — no duplication

#### Performance — Bulk Email Now Async
- `POST /api/bulk-email/send` now returns immediately (< 1s UI confirmation)
- Email sending runs in background (fire-and-forget)
- Branding/stores fetch + all Resend API calls are non-blocking
- `queued: true` flag in response lets frontend show instant success


#### Bulk Email — Attachments Now Delivered
- **Frontend** (`BulkEmailModal.tsx`): Images and file attachments are now read as base64 using `expo-file-system` and included in the send payload as `attachments: [{ filename, content, content_type }]`
- **Backend** (`bulkEmail.ts`): Zod schema now accepts optional `attachments` array; `sendViaResend` passes them to Resend API's `attachments` field
- Success modal only appears when backend confirms acceptance

#### Address & Phone Formatting — All Email Footers
- Address is now split correctly: first line = street, second line = City, State ZIP (e.g., `935 Hillsborough Mile\nPompano Beach, FL 33062`)
- Phone numbers formatted as `(XXX) XXX XXXX` automatically
- Applied to: stores footer cards in bulk email, transactional emails, booking emails

#### Legal Compliance Footer — All Emails
- Every email now includes a CAN-SPAM compliant footer below the stores section:
  - "You received this because you are a customer of {businessName}."
  - Business physical address
  - Unsubscribe link (`/api/unsubscribe?token=...`)
- Applied to ALL email types: booking confirmation, cancellation, rescheduled, reminder, transactional, bulk email
- Token is base64url-encoded `{ email, businessId, timestamp }`

#### Button Text Overflow Fix
- All modal buttons (Send Campaign, Cancel, Done, Send) now use `adjustsFontSizeToFit`, `numberOfLines={1}`, `minimumFontScale={0.7}` to prevent text clipping in any language

#### i18n — All 18 Languages Verified Complete
- Confirmed all bulk email keys present in all 18 language files: sendConfirmTitle, sendCampaignBtn, emailsSentSuccessfully, done, sending, cancel, previewTextLabel, imagesCounter, attachmentHelperText, etc.

### Bulk Email Send Fix + Global Email Footer Standardization (2026-02-27)

#### Problem 1: Bulk Email Send Button Did Nothing
The "Send" button in Bulk Email showed a confirmation modal then triggered a fake fire-and-forget that showed success immediately without actually sending emails.

#### Fix
- **Backend**: New `POST /api/bulk-email/send` route (`backend/src/routes/bulkEmail.ts`) that:
  - Accepts `business_id` + array of `{recipient_email, recipient_name, subject, body, preview_text?}`
  - Fetches business branding (logo, primary color) and ALL active stores
  - Generates the same branded HTML email style as all other system emails (colored header band, logo, card layout)
  - Sends via Resend API with retry logic (3 attempts, exponential backoff)
  - Returns `{success, sent, failed, results[]}`
- **Frontend** `BulkEmailModal.tsx`:
  - `executeSend` is now real async — calls backend API, awaits result
  - Loading state: Send button shows `ActivityIndicator` + "Sending..." while in-flight
  - Success: plays success sound + haptic, shows centered `emailsSentSuccessfully` modal, clears form, closes screen
  - Error: plays error sound + haptic, shows red error toast (3s), stays open for retry
  - No silent failures — every failure is visible

#### Problem 2: Email Footer Only Showed Main Store
All system emails (appointment confirmation, cancellation, reminders, transactional, bulk email) showed only the single main store address from business settings.

#### Fix — Global Multi-Store Footer
- **`getActiveStores(businessId)`** added to `backend/src/lib/email.ts` — queries `stores` table filtered by `business_id` and `is_archived = false`
- **`generateHtmlEmail`** updated with optional `stores` parameter and smart footer layout:
  - 1 store: centered
  - 2 stores: two equal columns with divider
  - 3 stores: three columns with dividers
  - 4+ stores: responsive two-column grid
  - Fallback: original single-store behavior when no stores found
- **`sendBookingEmail`**: now fetches stores and passes to `generateHtmlEmail`
- **`sendTransactionalEmail`**: now fetches stores and passes to `generateHtmlEmail`
- **`/api/bulk-email/send`**: includes multi-store footer from day one

#### i18n
- Added `emailsSentSuccessfully` key to all 18 language translation files and TypeScript types

### Service Gift Card — performGiftCardDebit DB Fallback Fix (2026-02-26)

#### Root Cause
`performGiftCardDebit` was never being called for service-based gift card appointments because `gift_card_id` was `null` in the `/outcome` (and `/complete`) request body. The mobile app passes `outcomeAppointment.giftCardId` which can be `undefined` when the appointment object in local state has a stale or incomplete `gift_card_id` field.

#### Fix
- **Backend `/outcome`**: When `gift_card_id` is null in the request body AND `debit_gift_card !== false`, the endpoint now looks up the appointment's stored `gift_card_id` directly from the DB before computing `effectiveGiftCardId`. This makes the debit work reliably regardless of what the mobile app sends.
- **Backend `/complete`**: Same DB fallback added — resolves `gift_card_id` from the appointment row when not provided in the request body.
- Both endpoints log `[Outcome/Complete] Resolved gift_card_id from DB: ...` when the fallback is used.



### Gift Card Debit Consistency Fix (2026-02-26)

#### Root Cause
`performGiftCardDebit` was bailing early when `gift_card_debited=true` without checking if the transaction row actually existed. Old code set the flag even when the INSERT failed, permanently blocking the audit record from being created.

#### Fixes
- **Backend `performGiftCardDebit`**: Reordered idempotency — checks for existing redemption row FIRST. If `gift_card_debited=true` but no row exists, enters "backfill mode": inserts the missing transaction WITHOUT re-debiting the balance.
- **Mobile `fetchGiftCardRedemptionByAppointment`**: Now queries by `appointment_id` alone (no `gift_card_id` required), with fallback to `gift_card_id` filter. Extensive logging added.
- **Mobile `useGiftCardRedemptionByAppointment`**: Hook now enables when `appointmentId` is non-null (previously required both).
- **View Appointment fallback**: If `gift_card_debited=true` but no tx row found yet, shows `appointment.amount` instead of `$0.00 (not yet debited)`.
- **Database backfill**: Manually inserted missing redemption row for appointment `2b2bbce1...`.

### Client Dedup v7 — Unique Email Enforcement + Deterministic Booking (2026-02-27)

#### Problem
Two clients with the same email could exist under the same business. This caused online bookings and internal appointment views to attach to the wrong client record (non-deterministic `LIMIT 1` without `ORDER BY`).

#### DB Migration (apply once via Supabase SQL Editor)
File: `backend/supabase/migrations/20260227000000_fix_client_dedup_v7.sql`

**To apply:** `GET /api/migrations/fix-client-email-uniqueness` → copy the `sql` field → paste in Supabase SQL Editor → Run.

What it does:
1. `CREATE UNIQUE INDEX idx_clients_business_email_unique ON clients (business_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> ''` — DB-level prevention of duplicate emails per business.
2. Creates `client_email_audit_log` table — records legacy duplicate collisions for visibility.
3. Replaces `create_public_booking` (both overloads) with v7: `ORDER BY created_at ASC, id ASC` (fully deterministic), normalizes email with `LOWER(TRIM(...))`, writes audit log when legacy duplicates are found.
4. Updates `create_online_booking` wrapper to delegate to v7-A.

#### Application-level fixes (already live)
- **`clientsService.createClient`** — now uses `eq('email', normalizedEmail)` + `ORDER BY created_at ASC, id ASC` (deterministic). Attaches full `existingClient` object to the duplicate error. Also catches DB-level `23505` unique constraint violations as a final safety net.
- **`ClientEditScreen`** — on duplicate email/phone: shows a toast with the `duplicateEmail`/`duplicatePhone` translation key and immediately navigates to the existing client's profile via `onSaveWithId(existingId)`. No longer blocks with an inline error that leaves the user stuck.
- **`BookAppointmentModal`** — on duplicate email/phone: silently auto-selects the existing client (`setSelectedClientId(existingId)`) and closes the new-client modal. Staff can proceed without interruption.

#### Appointment → Client join
- All appointment views join client via `client_id` FK (never by email). The `getAppointments` query passes `client_id` through `convertToLocalAppointment`, and `AppointmentsScreen` resolves the name via `clients.find(c => c.id === apt.clientId)` from the local cache.

### Fix Booking Language Settings Save Error (2026-02-25)

#### Root cause
The `booking_page_settings` Supabase table was missing the `enabled_locales`, `default_locale`, and `smart_language_detection` columns that the backend expected. The table exists but has a legacy schema (logo_url, primary_color, custom_domain, etc.).

#### Fix — `backend/src/routes/booking.ts`
- Language settings are now stored as a JSON blob in the existing `custom_domain` TEXT column with a `__lang_settings__:` prefix
- `parseLangSettings()` helper decodes the JSON blob back to typed fields
- Both GET and POST `/api/booking/settings/:businessId` now use the admin Supabase client to bypass RLS
- `/api/booking/config/:identifier` also updated to read from `custom_domain` instead of non-existent columns
- Zero DDL changes required

### Business Branding Color Fix for Online Booking Service Icons (2026-02-25)

#### `backend/src/routes/bookingPage.ts` — Service Icon Color Source of Truth
- Fixed service icon container color in the web booking page to always use `primaryColor` (business brand primary color) instead of `s.color || primaryColor`.
- Previously, if a service had a custom `color` value set in the database (e.g., the old default teal), the icon background would show that stale per-service color instead of the current business branding theme color.
- `servicesJson` now sets `color: primaryColor` for all services — the icon color is always driven by business branding, not per-service custom colors.
- This affects: Live Preview modal (WebView), Public booking page, and all embedded booking pages.

### Store Hours Source-of-Truth Fix (2026-02-24)

#### `backend/src/routes/booking.ts` — Hours Resolution Priority
- Store hours in the slots API now query `business_hours` table (store-scoped) as **primary source**, with fallback to `stores.hours` JSON snapshot, then business-default `business_hours` rows.
- Previously only used `stores.hours` JSON which could be stale.
- Double-booking prevention (booked slot exclusion) now uses **admin Supabase client** to bypass RLS — the slots endpoint is public (anon), so without admin client, existing appointments were invisible and slots weren't excluded.

#### `backend/src/routes/bookingPage.ts` — Enriched Store Hours
- `business_hours` query now fetches `store_id` column to distinguish store-specific vs default rows.
- Each store's `.hours` field is **overridden with live data from `business_hours` table** before being serialized to the booking page JS, ensuring the location card display always shows accurate hours.
- `businessDefaultHours` (store_id IS NULL) passed as JS `businessHours` fallback variable.

#### Supabase Data Fix — Store #2 Staff Weekly Schedules
- `staff_weekly_schedule` rows were missing for Store #2 staff (Edward, Dan, Liz).
- Inserted 7-day schedules (09:00-17:00 Mon-Sat, Sun off) for all three staff members.
- Root cause of "10 AM first slot" was NOT wrong hours — it was Edward's existing 9 AM appointment correctly blocking that slot. Dan/Liz correctly show 9 AM as first available.


#### Time Slots Fix (`backend/src/routes/booking.ts`, `mobile/src/app/book/[slug].tsx`)
- Root cause: RPC `get_available_slots` generates from staff schedule (not store hours). `stores.timezone` is `"UTC"` for all stores so `toWallClock` was a no-op.
- Backend now fetches `stores.hours` alongside timezone and filters each day's slots to only those whose HH:MM falls within `open_time..close_time` for that `day_of_week`. Closed days get zero slots.
- Frontend `formatTime` now extracts HH:MM directly from the wall-clock ISO string instead of re-parsing through `new Date()` (which applied device timezone and shifted the time).

#### Store Photos Fix (`backend/src/routes/booking.ts`)
- Config endpoint now returns `no-store, no-cache` headers (was `max-age=60` — stale cache blocked new photos).
- Store enrichment query now also fetches `hours` field so it's always present in the config response.

#### Service Icons Fix (`mobile/src/app/book/[slug].tsx`)
- Added `getServiceIcon(name)` — deterministic keyword-based icon resolver.
- Haircut/Barber → `Scissors`, Facial/Skin → `Sparkles`, Massage → `Hand`, Nail → `Flower`, Wax/Lash → `Zap`, Makeup → `WandSparkles`, Hydration/Clean → `Droplets`, Fitness → `Dumbbell`, Health → `Heart`, default → `Briefcase`.
- All icons use `brandColor` (business theme color) — no random colors.

### Store Photo Upload Hardening + Appointments Freshness (2026-02-24)

#### Backend: Storage Route Hardened (`backend/src/routes/storage.ts`)
- Added `sharp` dependency for server-side image processing
- Strict MIME/extension allowlist: JPEG, PNG, WEBP only (5MB max)
- Server-side image decode (rejects malformed/corrupt files)
- EXIF metadata stripping (privacy)
- Re-encode to JPEG quality 82, max 1600px longest edge
- Deterministic storage key: `stores/<store_id>/photo.jpg` + `_thumb` variant
- Per-store rate limiting: 10 uploads per 60 seconds (in-memory)
- `request_id` on every response for traceability (success and error)
- Response now includes `publicUrl`, `photoUrl`, and `url` for compatibility
- Structured error responses: `{ success, error, request_id, step }`

#### Frontend: Store Photo Service (`mobile/src/services/storePhotoService.ts`)
- Now resolves URL from `publicUrl || photoUrl || url` in backend response
- Error messages include `request_id` for debugging (visible in Alert toast)

#### Appointments Freshness (`mobile/src/hooks/useAppointments.ts`)
- Restored `staleTime` to 2 minutes (removed 30s hack)
- Added `refetchOnWindowFocus: true` to main appointments query
- `useCreateAppointment.onSuccess` now also invalidates client detail and forClient queries so Client Details appointment count updates immediately
- Imported `clientKeys` for targeted client cache invalidation

#### Appointments Screen (`mobile/src/components/AppointmentsScreen.tsx`)
- Added `useQueryClient` import
- AppState `active` listener now calls `queryClient.invalidateQueries(['appointments'])` so online bookings appear immediately when user returns to app
- Polling interval reduced to 2 minutes (from 5) and also invalidates appointment queries

### Book Appointment: Staff-Service Filtering + Gift Card UI Upgrade (2026-02-23)

#### Staff → Services Filtering
- Selecting a specific staff member now **filters the Services list** to only show services that staff member can perform (based on `staff_services` table).
- "Any Staff" selected → all services shown (unchanged).
- Specific staff selected + has skill assignments → only their allowed services shown.
- If the currently selected service becomes invalid after switching staff, it is **auto-removed** and a toast notification appears: "Some services were removed because this staff member doesn't offer them."
- Debug logging added: `selected_staff_id`, `returned_service_ids_count`, `excluded_services_count`.
- Uses existing `useStaffServiceSkills(staffId)` hook from `hooks/useStaffServices.ts`.

#### Gift Card UI Upgrade
- Replaced emoji 🎁 with `Gift` vector icon from `lucide-react-native`, **theme-color aware** (uses `primaryColor`).
- Replaced switch toggle with a **check-circle control** matching the Settings → Appointments toggle style.
- Copy text now uses i18n keys: `clientWillUseGiftCard`, `giftCardWillBeDebitedOnCompletion`, `noGiftCardForAppointment`.
- All 17 non-English translation files updated with localized strings.

### Enterprise Appointment Lifecycle System (2026-02-25)

A financial-grade appointment lifecycle system guaranteeing revenue accuracy, gift card integrity, and real-world operational control.

#### Lifecycle States
- **Scheduled** → default on creation
- **Checked-In** → staff taps "Check In Client" — client physically arrived
- **Pending Confirmation** → time passed with no check-in — staff must confirm outcome
- **Completed** → revenue finalized; gift card optionally debited depending on selected outcome
- **No Show** → no revenue, no gift card debit
- **Cancelled** → no revenue, no gift card debit

#### Key Features
- **Check-In Button** in appointment view modal (green) — one tap marks arrival
- **Auto-Completion**: checked-in appointments auto-complete when duration ends
- **Confirm Outcome Modal**: 4 choices — Completed (revenue only) / Completed + Gift Card (revenue + debit) / No Show / Cancelled
- **Two Completed Variants**: `debit_gift_card: false` for revenue-only; `debit_gift_card: true` for revenue + gift card debit
- **Gift Card Intent Toggle** in BookAppointmentModal — debit only happens if Completed + Gift Card selected
- **Color-coded lifecycle badges** on appointment cards — all use theme/primary color (no hardcoded yellow/orange)
- **Revenue Integrity**: analytics only counts `lifecycle_status = 'completed'`
- **Background polling** every 5 min + on app focus via `transition_overdue_appointments`
- **Confirm Outcome header**: icon (theme color) left-aligned + title left-aligned, consistent with Settings style

#### New Backend Routes
- `POST /api/appointments/check-in`
- `POST /api/appointments/complete`
- `POST /api/appointments/outcome`
- `POST /api/appointments/transition-overdue`
- `GET /api/migrations/appointment-lifecycle-sql`

#### REQUIRED: Run Migration SQL
Paste the SQL from `SUPABASE_MIGRATION_RUN_THIS.sql` (bottom section) into your [Supabase SQL Editor](https://supabase.com/dashboard).
Or fetch it via: `GET /api/migrations/appointment-lifecycle-sql`

### Lifecycle Fix Patch (2026-02-23)

**Problem fixed**: `transition_overdue_appointments` RPC was failing with `relation "eligible_gc" does not exist` — caused by a stale function body in Supabase that referenced a CTE name from an earlier draft.

**Fix**: `SUPABASE_LIFECYCLE_FIX.sql` — run once in Supabase SQL Editor to:
1. Replace `transition_overdue_appointments` with the correct body (no `eligible_gc` reference)
2. Ensure `gift_card_transactions.business_id` and `.store_id` columns exist
3. Send `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache

All app-side code (backend routes + mobile service functions) was already using the correct RPC names and parameter signatures — no app code changes needed.



### Gift Cards — Store Filter + Revenue Insights (2026-02-23)
- **`GiftCard` type**: Added optional `storeId` field; `SupabaseGiftCard` interface and `supabaseToGiftCard()` mapper now include `store_id`.
- **Main Gift Cards page — Store Filter**: When multiple stores exist, a horizontal chip selector appears below the stats banner (All Stores / per store). Selecting a store filters the list AND the Active/Balance KPI stats. Search always remains global across all stores.
- **Active KPI card** ("Tap to view →") now reflects the selected store count.
- **Balance KPI card** is now tappable ("View insights →") and opens the new `GiftCardRevenueModal`.
- **KPI card colors** unified to `primaryColor` (removed hardcoded `#10B981`).
- **`GiftCardRevenueModal`**: New modal showing:
  - Store filter (All Stores / per store) — same chip pattern
  - Total Issued + Best Month KPI cards
  - Monthly bar chart (last 12 months) — best month bar is full `primaryColor`, others are `primaryColor` at 33% opacity
  - Monthly breakdown list with BEST badge highlight
- **`ActiveClientsModal` — Store Filter**: Store chip selector added inside the modal. Initializes from the parent's selected store. Client list and count update per store.
- **Header icon + empty state** in `ActiveClientsModal` now use `primaryColor` (was hardcoded `#10B981`).
- Balance value text in `ActiveClientsModal` rows updated to `primaryColor`.


- **Settings → Stores list**: Crown and house icons replaced with real store photo thumbnails (rounded square). Placeholder shows camera icon with "Add Photo" when no photo yet.
- **Edit Store modal**: Photo section added at the top of the form — large rounded square thumbnail, Change/Remove buttons, uploads via `storePhotoService` (same pipeline as staff photos).
- **Store photo upload**: `handleSaveStore` now uploads/removes store photos and saves `photo_url`+`photo_thumb_url` to Supabase on save.
- **Online Booking → Store selection**: Already used `photo_thumb_url`/`photo_url` (no change needed).
- **Online Booking → Services list**: Each service now shows a colored icon (rounded square using `service.color`) on the left, matching the style of staff/store thumbnails. Price now inherits service color.

### Promotion Counter — DB-backed with Audit Trail (2026-02-21)
- **Promotion Counters are now stored in Supabase** (`promotion_counters` + `promotion_counter_redemptions` tables) — no longer Zustand-only
- **Add Count modal** now requires service selection (no auto-select), plus optional store, staff, date, and note
- **Tappable history rows** open a Redemption Details modal showing full history with date, service, store, staff, and note
- **Edit support** with full audit trail: `original_snapshot JSONB` is preserved on first edit; "Edited" badge shows on edited entries
- **Email sent** on every Add Count and Edit via `promotion_counter_reward` transactional event
- DB trigger `sync_counter_current_count` auto-updates `current_count` and `is_completed` on the parent counter
- Zustand remains for display caching only; DB is the authoritative source
- **New files**: `src/services/promotionCountersService.ts`, `src/hooks/usePromotionCounters.ts`
- **New backend**: `backend/src/routes/promotionCounters.ts` (GET/POST counters, GET/POST/PATCH redemptions)
- **Migration**: `backend/supabase/migrations/20260221100000_promotion_counters.sql`

### Visit History — Improved data display (2026-02-21)
- Visit cards now show service names even if the service was deleted (uses `service_name` column on appointment as fallback)
- Staff and store names now show in visit cards using resolved names from the appointment join
- Promotion name shows in visit history using stored `promo_name` fallback
- Amount display now prioritizes `total_cents` (most accurate) before falling back to `amount`
- `getClientAppointments` query now joins `service:service_id(id, name, price_cents)` for richer service data
- Visit and Visits Modal both updated to use fallback `serviceNames`, `staffName`, `storeName`

## REQUIRED: Run Migration SQL in Supabase

Run the following SQL in your **Supabase Dashboard → SQL Editor** to activate all pricing + drip campaigns features:

```sql
-- File: backend/supabase/migrations/20260220200000_appointment_pricing_columns.sql
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cents    INTEGER;

CREATE INDEX IF NOT EXISTS idx_appointments_total_cents
  ON public.appointments(business_id, total_cents)
  WHERE total_cents IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly','biweekly','monthly','custom')),
  custom_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_eu_enabled BOOLEAN NOT NULL DEFAULT false,
  emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_business_id
  ON public.drip_campaigns(business_id);

ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drip_campaigns_owner" ON public.drip_campaigns;
CREATE POLICY "drip_campaigns_owner" ON public.drip_campaigns
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
```

## Features Implemented

### Authentication
- Sign in / Sign up flow with business name
- **Supabase Authentication** - Production-ready backend authentication:
  - Email/password authentication via Supabase Auth
  - **Google Sign In** - OAuth via Supabase + expo-auth-session (`signInWithOAuth('google')`)
  - **Apple Sign In** - OAuth via Supabase + expo-auth-session (`signInWithOAuth('apple')`) — iOS only
  - Social auth deduplicates by verified email — no duplicate accounts created
  - New social users follow the same business-creation + invite-processing onboarding path
  - Automatic session persistence (stays logged in across app restarts)
  - Profile layer with Row Level Security (RLS)
  - Multi-tenant data isolation (each user sees only their data)
  - Secure token refresh and session management
- **Face ID Authentication (iOS only)** - Biometric login for quick access:
  - Enable/disable Face ID toggle in Settings
  - Requires password confirmation to enable
  - Auto-prompts Face ID on app launch when enabled
  - "Use Password Instead" fallback option
  - Securely stores auth token in iOS Keychain (expo-secure-store)
  - Automatically disabled on logout or password change
  - Full localization support (18 languages)
- **Complete User Data Isolation** - Each user account is completely isolated:
  - Users only see their own clients, promotions, campaigns, and data
  - All CRUD operations are restricted to the logged-in user's data
  - Deterministic user IDs ensure same email = same account across sessions
  - No data leakage between accounts (switching users requires full logout)

### Dashboard
- Welcome header with business name and **Database logo**
- Key stats: total clients, **New Clients** (was "New This Month"), promotions used, active clients
- **Tappable stat cards** - tap any stat to see detailed client list:
  - Total Clients: shows all clients alphabetically, with store filter option
  - New Clients: shows clients added this month sorted by date, with store filter option
  - Promotions Used: shows clients with promotions sorted by count
  - Active Clients: shows clients with visit history
  - Store filter in detail views uses user's selected theme color and translates automatically
- Quick actions (dynamically shown based on features):
  1. Add Client
  2. Add Visit
  3. Appointments (only when Calendar feature is enabled) - Opens full appointments management
  4. Marketing Promo
  5. Bulk Email
  6. Drip Campaigns
- Recent activity feed with client cards

### Bottom Navigation
- **Four-tab navigation**: Dashboard, Clients, Analytics, Settings
- Analytics tab provides direct access to business statistics
- Analytics data is prefetched in the background on Dashboard load for instant tab switching
- Consistent navigation across all screen sizes

### Marketing Promotions
- **Create and manage marketing promotions**
  - Percentage discounts (e.g., 10% off for Father's Day)
  - Fixed amount discounts (e.g., $5 off Black Friday)
  - Counter promotions (e.g., buy 5 haircuts, get 1 free)
- Set start and end dates for promotions
- Color-coded promotions for easy identification
- Activate/deactivate promotions
- Edit and delete promotions
- **Promotion Redemption Tracking** (Single Source of Truth):
  - Dedicated `promotion_redemptions` table tracks all promotion usage
  - Postgres trigger `trg_sync_promotion_redemption` auto-populates on appointment insert/update
  - Backfill migration populates all historical appointments with promos
  - Client Details → Promotions shows complete redemption history
  - Analytics → Promotions Redeemed counts directly from `promotion_redemptions` (no appointments fallback)
  - RPCs: `get_promotions_redeemed_count`, `get_promotions_redeemed_rows`, `get_promotions_breakdown`, `get_client_promotions_used`
  - Supports store filtering and time-based analytics
  - **Migration required**: run `backend/supabase/migrations/20260220000000_promotion_redemptions.sql` in Supabase SQL Editor
- **Promotions Auto-Apply (Staff Booking + Log Visit)**:
  - When staff selects a promotion in BookAppointmentModal or AddVisitModal, the discount is calculated BEFORE saving
  - All three pricing columns persisted to Supabase: `subtotal_cents`, `discount_cents`, `total_cents`
  - Discount engine (`computedPricing` useMemo): supports `percentage`, `fixed`, and `free_service` promo types
  - `free_service`: discount = full subtotal → total = $0 (free), stored and emailed correctly
  - `fixed`: discount capped at subtotal (never negative)
  - `percentage`: rounded to nearest cent
  - Amount field in UI auto-updates to reflect post-discount total for staff visibility
  - Appointment confirmation email shows breakdown (Subtotal / Discount with promo name / Total)
  - Online Booking flow NOT modified (promotions not selectable there)

### Loyalty Program (Points-Based Rewards)
- **Configurable points-based loyalty program** with business-level settings:
  - Enable/disable loyalty program per business
  - Configurable points-per-dollar earning rate (e.g., 1 point per $1 or 2 points per $1)
- **Reward Tiers Management**:
  - Create custom reward tiers (e.g., 100 points = Free Facial, 500 points = Free Massage)
  - Three reward types: Custom reward, Credit amount, or Linked service
  - Set notification messages when rewards are unlocked
  - Activate/deactivate rewards without deleting them
- **Client Profile Integration**:
  - Loyalty Points card in Client Details showing:
    - Current point balance
    - Lifetime points earned
    - Enrollment status
    - Progress bar to next reward
  - Full loyalty modal with:
    - Available rewards the client can redeem
    - All rewards with progress tracking
    - Complete transaction history
    - Toggle enrollment on/off per client
- **Automatic Point Accumulation**:
  - Points auto-awarded when appointments are booked with an amount
  - Works for both single and recurring appointments
  - Points calculated as: `amount × points_per_dollar`
  - Full audit trail with source tracking (appointment ID, revenue amount)
- **Reward Redemption System**:
  - One-tap redemption from client profile
  - Automatic point deduction on redemption
  - Redemption status tracking (pending, confirmed, used, cancelled)
  - Staff confirmation workflow ready
- **Loyalty Analytics** (in Analytics section):
  - Total points issued in period
  - Total rewards redeemed
  - Active loyalty members count
  - Points redeemed in period
  - Golden visual theme for loyalty metrics
- **Database Tables**:
  - `loyalty_settings` - Business-level configuration
  - `loyalty_rewards` - Configurable reward tiers
  - `client_loyalty` - Client enrollment and point balances
  - `loyalty_transactions` - Complete point history/audit log
  - `loyalty_redemptions` - Reward redemption records

### Membership Program (Offline Payments)
- **Business-level membership program** with fully configurable plans:
  - IMPORTANT: All payments are collected OFFLINE (in-store POS / cash / external processor)
  - This system only tracks membership status, dates, benefits, and usage - NO payment processing
  - Enable/disable membership program per business
  - Notification settings for renewal reminders and past-due alerts
  - Grace period configuration before expiration
- **Configurable Membership Plans**:
  - Create unlimited plans (e.g., Bronze, Silver, Gold, VIP)
  - Set display price (for reference only - not processed)
  - Renewal cycle options: Monthly, Yearly, or Custom interval
  - Auto-renew tracking flag (for manual follow-up)
  - Activate/deactivate plans without deleting
- **Fully Configurable Benefits** (per plan):
  - **Discount**: Percentage off all services (e.g., 10% off)
  - **Free Service**: Include free services per cycle (e.g., 1 free haircut/month)
  - **Monthly Credit**: Store credit added each renewal (e.g., $50/month)
  - **Custom Perk**: Text-based perks (e.g., "Priority booking", "VIP lounge access")
- **Client Enrollment** (Manual/Offline):
  - Enroll clients in membership from Client Details
  - Set start date and next renewal date
  - Select payment method tracking (Cash, Card, External, Other)
  - Add notes for internal tracking
  - Initial credit balance from plan benefits
- **Membership Status Management**:
  - Status types: Active, Past Due, Cancelled, Expired, Paused
  - Mark Payment Received (manual confirmation)
  - Pause/Resume membership
  - Cancel membership with reason
  - Full payment history per membership
- **Credit Ledger System**:
  - Automatic credit addition on renewal (if plan includes credits)
  - Credit usage tracking with full audit trail
  - Balance tracking per membership
  - Transaction types: credit_added, credit_used, credit_expired, credit_adjustment
- **Benefit Usage Tracking**:
  - Log every benefit redemption for audit
  - Free service usage counting per cycle
  - Discount application logging
  - Credit usage with appointment/visit context
- **Membership Analytics Dashboard**:
  - Active members count
  - Past due members count
  - Estimated monthly/yearly revenue (display only)
  - Total credits used
  - Total free services redeemed
  - Top plans by member count
- **Benefits Application** (during checkout/visit):
  - Automatic discount calculation for active members
  - Free service availability check
  - Credit balance display
  - Deterministic benefit application with audit logging
- **Database Tables**:
  - `membership_settings` - Business-level configuration
  - `membership_plans` - Plan definitions with benefits
  - `client_memberships` - Client enrollment records
  - `membership_payments` - Manual payment tracking
  - `membership_credit_transactions` - Credit ledger
  - `membership_benefit_usage` - Benefit redemption audit log

### Analytics (formerly Monthly Stats)
- **RPC-Only Architecture** - All analytics data fetched exclusively via `get_monthly_analytics_overview` RPC:
  - NO direct table queries from the client
  - NO fallbacks to direct queries - if RPC fails, shows error state with retry button
  - Single source of truth for all analytics KPIs
  - "Your Best Clients" uses RPC's `top_clients` array directly
  - Error handling driven by: Supabase RPC error object OR data.success field
  - Empty state driven by: explicit data array length checks (e.g., `top_clients.length === 0`)
  - Auth/permission errors (42501) show authorization state, not empty data
  - Multi-role RBAC preserved - no changes to RLS or authorization logic
- **View business statistics with flexible time filters**
  - Daily, Weekly, Monthly, and Yearly views
  - Total clients by end of period
  - New clients this period
  - Total visits
  - **Revenue tracking** - Combines revenue from:
    - Logged visits with amount
    - Booked appointments with amount (excludes cancelled appointments)
  - Promotions redeemed
- **Auto-refresh on client deletion** - When a client is deleted:
  - Client is permanently removed (hard delete)
  - All client's appointments are CASCADE deleted by the database
  - Analytics automatically refreshes to show updated totals and revenue
  - Clients list, Appointments list, and all analytics caches are invalidated
- **Automatic date reset** - Opens to today's date every time; always shows current data first
- **Day-by-day navigation** - In daily view, navigate through each day within the month
- **Week-by-week navigation** - In weekly view, navigate through each week within the month
- **"Best Month of Year" section** - Automatically highlights which month had the best performance based on visits and revenue
- **"What's working for you?" section** - Shows TWO insights:
  - Best-performing promotion for the selected period
  - Most-used service (based on service tags) for the selected period
- **AI-Powered Insight Cards** - Seven interactive insight cards with soft backgrounds and dynamic data (all clickable with drill-down views):
  - **Best Month** - Highlights the best-performing month of the year
  - **What's Working for You** - Shows best promotion and top service
  - **What's Bringing Clients Back** - AI-generated recommendation based on data patterns
  - **Average Revenue Per Client** - Average earned per client with top revenue clients list
  - **Your Busiest Times** - Revenue by day of week with visual bar chart breakdown
  - **Return Rate** - Percentage and count of returning clients
  - **Clients At Risk** - Configurable inactive client detection with settings button:
    - Custom time period filter (7, 14, 21, 30, 45, 60, 90, 120, 180 days)
    - Adapts to business type (haircuts every 2 weeks vs oil changes every 3 months)
    - Shows list of at-risk clients with last visit date
- **Navigate periods** - Navigate between days/weeks/months/years without future dates
- **Filter by promotion** - See which promotions bring in the most clients
- **Drill-down views** - Tap any stat card (white or colored) to see detailed list:
  - Total Clients → Opens list of all clients with profile access
  - New This Period → Shows clients added in the period
  - Total Visits → Shows all recorded visits with client info
  - Revenue → Shows transactions contributing to total revenue
  - Promotions Redeemed → Shows redeemed promotions with client profiles
  - All insight cards → Each reveals detailed breakdown and client lists
- **Store Filtering in Drill-downs** - All drill-down views support per-store filtering:
  - Filter by specific store or view combined data across all stores
  - Applies to: Total Clients, New Clients, Appointments, Revenue, Promotions, Top Services, Best Month, Busiest Times, Best Clients, Clients At Risk
  - Dashboard totals remain unchanged (show combined data)
  - Filters reset when returning to main Analytics view
- **Multi-Store Performance Compare Mode** - Advanced store comparison analytics:
  - Toggle "Compare Mode" in Analytics to switch to multi-store comparison view
  - Multi-select Store Picker to choose which stores to compare
  - KPIs per store: Revenue, Total Appointments, New Clients, Returning Clients
  - Store Rankings with visual progress bars for easy comparison
  - **Insights Engine** - Auto-highlights key store insights:
    - Top Performing Store (highest revenue)
    - Fastest Growing Store (highest growth rate vs previous period)
    - Biggest Revenue Drop (store with largest decline)
    - Highest Returning Client Rate (best customer retention)
  - All data scoped by business_id and store_id for data consistency
  - Fully translated in all 18 supported languages
- **Dashboard Top Store Widget** - Lightweight dashboard card showing:
  - "Top Store This Month" with store name and revenue
  - Appointment count for the top-performing store
  - Only appears when business has 2+ stores

### Visit Management
- **Add Visit** - Quick action to record client visits
  - Select client from dropdown
  - Choose services from service tags
  - Add amount and notes
  - Track promotion usage
  - **Calendar date picker** - When Appointments/Calendar feature is enabled:
    - Visual calendar view to select visit date
    - Expandable/collapsible for non-intrusive experience
    - Shows selected date with day of week
    - Syncs with the existing Visit Date field
    - Hidden when Calendar feature is disabled in Settings
  - Automatically updates client visit history

### Bulk Email
- **Send emails to multiple clients at once**
  - Select multiple recipients with checkboxes
  - Filter clients by service tags
  - **Advanced filtering options**:
    - All Clients
    - New Clients - clients registered this month (renamed from "New This Month")
    - Promotion Users - clients who have participated in promotions
    - Filter by specific promotion
  - Select All / Deselect All buttons
  - Compose email with subject and body
  - Attach files (documents, images, etc.)
  - View attached file names and sizes
  - **CAN-SPAM Compliant** - All emails include mandatory unsubscribe link

### CAN-SPAM Compliant Email System
- **System-enforced opt-out mechanism** that cannot be disabled by business users
- **Automatic unsubscribe footer** - Injected on ALL commercial emails
- **One-click unsubscribe** - No login, password, or confirmation required
- **Opt-out status check** - System blocks emails to opted-out recipients
- **Business-level isolation** - Unsubscribing from one business doesn't affect others
- **Audit logging** - All opt-out and re-subscribe events are logged
- **Re-subscribe flow** - Users can explicitly re-subscribe after opting out
- **30-day link validity** - Unsubscribe links remain active for at least 30 days
- **Soft opt-in** - Clients are opted-in by default at registration with clear disclosure
- Complies with U.S. CAN-SPAM Act and Florida electronic communications regulations

### Drip Email Campaigns
- **Automated drip email sequences**
  - Create campaigns with multiple emails in sequence
  - Color-coded campaigns for easy identification
  - Configurable send frequency:
    - Weekly
    - Every 2 weeks
    - Monthly
    - Custom intervals (any number of days)
  - Activate/pause campaigns at any time
  - Assign clients to campaigns
  - Edit and delete campaigns
  - Email sequence builder with subject and body

#### Email Drip Campaign Legal Protection (CAN-SPAM Compliant)
- **Platform Role Disclosure** - Visible on campaign creation/editor screens:
  - "All email drip campaign content is created solely by the business owner..."
  - Required for Apple App Store and Google Play compliance
- **Mandatory Email Opt-Out Enforcement**
  - Every drip email automatically includes visible unsubscribe link
  - Immediate opt-out enforcement
  - Automatic suppression of unsubscribed addresses
  - Cannot be disabled, modified, or overridden
- **Mandatory Non-Editable Email Footer**
  - Business name
  - Valid physical business address
  - Unsubscribe link
  - "Sent on behalf of the business listed above"
  - Footer preview shown in campaign editor
  - Cannot be edited or removed
- **Business Address Requirement (Compliance Gate)**
  - Campaigns cannot be activated without a business address in Settings
  - Business address field added to Settings profile section
  - Clear warning displayed when address is missing
  - **Country-Based Legal Compliance**
    - Country dropdown with flags and search bar for easy filtering
    - Selecting a country auto-populates legal footers based on local laws
    - Support for 40+ countries with localized legal requirements
  - **USA State-Specific Compliance**
    - For USA: State dropdown appears with all 51 states/territories
    - State-specific legal footers (e.g., Florida CAM, California CCPA, New York regulations)
  - **Multi-Language Footer Support (18 Languages)**
    - Footer text language selector (does not determine which laws apply)
    - Supported: English, Spanish, French, Portuguese, German, Italian, Dutch, Swedish, Norwegian, Danish, Finnish, Icelandic, Russian, Turkish, Chinese, Japanese, Korean
  - **Dynamic Footer Preview**
    - Live preview of email footer in Settings modal
    - Shows business name, address, receiving text, unsubscribe link, and legal notice
    - Legal notice automatically changes based on country/state selection
  - Helper text: "Legal requirements for emails will be automatically applied based on local laws and selected language"
- **Consent & Compliance Acknowledgment**
  - Required checkbox before first campaign activation:
  - "I confirm that I have obtained proper consent from recipients and that I am legally permitted to contact them via email."
  - Acceptance logged with user ID, campaign ID, timestamp, app version
- **Acceptance Logging (Audit Protection)**
  - All campaign activations, deactivations, and blocked attempts logged
  - Consent acceptance records persisted for legal audits
  - Acceptance ID linked to activation logs

#### Smart Drip Templates
- **Official Templates (Database Pre-Written)**
  - 5 professionally written, ready-to-use email templates:
    1. **Welcome New Clients** - Warm welcome sequence for new clients with business intro
    2. **Active Client Appreciation** - Monthly appreciation emails for regular clients
    3. **Win Back Inactive Clients** - Re-engagement sequence for clients inactive 60-90 days
    4. **Promotion Follow-Up** - Follow up with clients who used a promotion
    5. **VIP High Spender Appreciation** - Exclusive appreciation for highest-spending clients
  - Templates are locked (non-editable) to ensure quality and compliance
  - Auto-populate business info: {{business_name}}, {{business_address}}, {{business_phone}}, {{client_first_name}}
- **Template Activation Flow**
  - Tab-based UI: "Campaigns" and "Templates" tabs in Drip Campaigns screen
  - Select a template to see preview and customize settings
  - **Frequency Selector**: Send Once, Weekly, Every 2 Weeks, Monthly, Custom interval
  - **Automation Triggers**:
    - New Client - Trigger when a new client is added
    - Active Monthly Client - Clients who visit at least once a month
    - Client At Risk - Inactive for 60-90 days
    - Promotion Users - Clients who used a promotion
    - High Spend Client - Top spending clients
    - Custom Filter - Create your own criteria
  - Email preview with placeholder substitution
  - Creates a new campaign from template (starts inactive for consent flow)
- **Smart Drip Recommendation in Analytics**
  - "Clients at Risk" section shows recommendation banner when inactive clients exist
  - "Win back X inactive clients with an automated email sequence" call-to-action
  - One-tap navigation to Drip Campaign Templates screen
  - Recommends the "Win Back Inactive Clients" template

### Client Management
- Client list with search functionality
- **Add/Edit Client Page Header** - Consistent with all other pages (Appointments, Log Visit, Marketing Promo, Bulk Email):
  - Icon with rounded container on left
  - Page title with bold 18px font
  - X close button on right
  - Same padding and border styling
- **Consistent Client Search Design** - All client search lists across the app use the same design:
  - Avatar with two initials (First Name initial + Last Name initial)
  - Full First Name + Last Name
  - Email and phone number displayed consistently
  - If a client has only one name, uses the first two letters
  - Client lists always displayed in alphabetical order by First Name
  - Alphabetical ordering persists dynamically as user types
- **Filter by tags** - Filter clients by service tags with multi-select
- Add new clients with full details
- Edit client information
- Archive/unarchive clients (soft delete)
- Permanently delete clients
- View client details with visit history
- **Edit visit history** - Edit previous visit entries (tags, amount, notes) with modification timestamp tracking
- **Call client** - Tap to call the client directly from the app
- **Send email** - Compose and send email with file attachments from client profile
- **Assign drip campaign** - Select a campaign directly from client profile
- **Assign active promotion** - Select which marketing promotion the client is currently using
- **Promotion counter** - Track client progress toward rewards:
  - Add promotion counters to individual clients
  - Customizable target count (e.g., 5 haircuts for free one)
  - Visual progress bar
  - Add count button to increment progress
  - History tracking with date and service for each count
  - Completed status when target is reached
- **Tappable Visits card** - Opens detailed view with full visit history (date, day, services, notes, amount)
- **Tappable Promotions card** - Shows all promotions the client has redeemed with details
- **Tappable Appointments card** - Replaced the Visits card next to Promotions:
  - Shows count of upcoming appointments for the client
  - Opens a detailed modal with all upcoming (future) appointments
  - Each appointment displays in Log Visit style layout:
    - **Appointment Time** section (date + time) - replaces the Client section since we're already in client context
    - Select Store (if assigned)
    - Staff Member (if assigned)
    - Service Tags
    - Amount/price with correct currency symbol (no duplication)
    - Notes
  - **All fields are fully editable** inline:
    - Change appointment date using date picker
    - Edit start and end time
    - Change store (with dropdown)
    - Change staff member (filtered by store)
    - Toggle service tags
    - Edit amount with currency selector (currencies based on user's language)
    - Edit notes
  - Auto-save on every change
  - Real-time sync with main Appointments calendar
  - Full localization support (all labels translate automatically)

### Appointments / Calendar (Optional Feature)
- **Appointments Overview Screen** - Central hub for appointment management:
  - **Quick Search Bar** (Enterprise-grade) - Instant appointment lookup at the top:
    - Search by **Confirmation Code** (8-character code from booking email)
    - Search by **Last Name** (supports partial matching)
    - Search by **Phone Number** (strips formatting for smart matching)
    - Search by **Email Address** (partial matching)
    - **Instant results** - Filters client-side from cached data for sub-second response
    - Search results display: Client name, service, staff, store, date/time, status
    - Status badges: UPCOMING (green), COMPLETED (gray), CANCELLED (red)
    - Tap any result to jump directly to that appointment's date
    - Works across **all stores** (not limited to current filter)
    - Searches past year + next 6 months of appointments
  - **Full-page scrolling** - Entire page scrolls vertically for better usability:
    - Scroll up/down to view all page elements including header, action buttons, filters, and calendar content
    - Improves viewing of the full calendar on smaller screens
    - Consistent scroll behavior across all view modes (list, week, month, day)
  - Default view shows "My appointments for today"
  - **Three Action Buttons** at the top for easy access:
    - **Book Appointment** - Create new appointments (primary color)
    - **Edit Appointment** - Opens appointment selector to choose which one to edit (blue)
    - **Restore Previous Appointment** - Restore cancelled appointments (green, only shows when cancelled appointments exist)
    - All buttons auto-resize text and wrap for long translations
  - **Expanded Date Range Options**:
    - Quick filters: Yesterday, Today, Tomorrow, This Week, This Month
    - Day-by-day navigation with left/right arrows
    - Week-by-week navigation (Previous Week / Next Week)
    - Monthly navigation (Previous Month / Next Month)
    - Full calendar picker for selecting any date (past or future)
  - Month/year navigation within calendar picker
  - Orange dot indicators for days with appointments
  - Clear "No appointments" state with easy booking action
- **Store Filter** - Filter appointments by store/location (only shown if stores exist):
  - Dropdown to select specific store location
  - Automatically selects first store by default
  - When a store is selected, only that store's appointments are shown
  - Staff filter automatically updates to show only staff from the selected store
- **Staff Filter** - Filter appointments by staff member:
  - Dropdown to select specific staff member (e.g., Tom, Jenny)
  - Shows only staff assigned to the currently selected store
  - "All Staff" option to see everyone's appointments in the selected store
  - Filter applies to both list and schedule views
- **View Mode Toggle** - Switch between List and Schedule views:
  - **List View** - Traditional appointment list:
    - Client name with avatar
    - Start and end time
    - Service tags (color-coded)
    - Notes preview
    - Date headers for week/month views
    - Tap to edit any appointment
    - **Appointment Card Design**:
      - Left border uses user's selected theme color for visual consistency
      - Staff display: Name first, then "STAFF" label below (uppercase)
      - Client display: Name first, then "CLIENT" label below (uppercase)
      - All text fully translated according to user's selected language
    - **Visual Status Indicators** - At-a-glance appointment status:
      - "Visit Ongoing" badge (primary color) for appointments currently in progress
      - "Next Visit" badge (orange) for the upcoming appointment when nothing is ongoing
      - "Upcoming" label (subtle) for future appointments
      - Past appointments shown with reduced opacity
      - Status-based background tinting and border colors
  - **Daily Schedule - Staff Column View** - Visual grid overview:
    - Vertical time column on the left (8 AM - 8 PM)
    - **"Any Staff" Column** - First column after time, displayed when staff members exist:
      - Shows all appointments without an assigned staff member
      - Allows easy identification of unassigned appointments
      - Click to edit and assign staff member
      - Appointments move to staff column once assigned
      - Same time-slot alignment as other columns
    - Each staff member displayed as a separate column
    - Appointments displayed as blocks within each staff column
    - Color-coded by staff member
    - **Enhanced Display Format**: Shows "{client_name} • {service_name}" when service_name is available
    - Falls back to client name only if service_name is missing
    - **Visual Status Indicators** - Ongoing and next appointments highlighted with status dots and labels
    - Perfect for seeing who's working, who has appointments, at what time, with which client
    - Available for all time ranges (today, past, future, weeks, months)
- **Edit Appointments** - Full editing capabilities:
  - **Wheel Date Picker** - Same design as Log Visit for consistency:
    - Tap to expand/collapse the native wheel picker
    - Accent color follows Settings theme color
    - Month/day names automatically translate based on Settings language
    - Selected date saves correctly to the appointment
  - **Amount field** - Enter service price with currency symbol:
    - Currency symbol updates automatically based on Settings currency
    - Positioned above Service Tags for clear visibility
  - **Auto-populate from appointment record**:
    - Store, Staff, and Service auto-select from appointment.service_id
    - Amount auto-fills from appointment.service_price (cents converted to dollars)
    - Falls back to services table price_cents if service_price is null
  - Modify start/end time
  - Update service/title
  - Add or edit notes
  - **Add to Calendar** - Export appointment to external calendars:
    - Google Calendar - Opens Google Calendar with pre-filled event
    - Outlook - Opens Outlook.com with pre-filled event
    - Download .ics - Downloads RFC5545-compliant calendar file for Apple Calendar and other apps
    - Available for both business owner appointments and public booking confirmations
    - Localized button labels (18 languages)
  - **Cancel Appointment** - Mark appointment as cancelled with confirmation modal:
    - Revenue from cancelled appointments is automatically excluded from Analytics
    - Warning message explains revenue impact before confirmation
    - Cancelled appointments show visual indicator
  - Delete appointment option
  - Changes save immediately
- **Book Appointment** - Create new appointments from the Appointments screen:
  - Select date from visual calendar
  - Search and select existing client
  - **Smart Store Handling** - Store section always visible with clear status:
    - **Auto-Creation**: If no stores exist, a default store is automatically created using the business name
    - **Loading State**: Shows "Loading..." while stores are being fetched or auto-created
    - **No stores**: Warning message displayed, Save button disabled, prompts user to create store in Settings
    - **Single-store businesses**: Store auto-selected and shown (read-only display)
    - **Multi-store businesses**: Store dropdown picker always visible (required selection)
    - Staff selection is disabled until a store is selected
    - Debug logging for store/staff fetch operations
    - Full localization support (18 languages)
  - **Client details auto-populate** when selected (matching Client Details layout):
    - Email address
    - Phone number (formatted)
    - Call button (opens phone dialer)
    - Email button (opens email compose)
    - Client notes
    - Service tags from visit history
  - Set start and end time
  - **Services (Required)** - Select one or more services from the business's service list:
    - Services are loaded from `public.services` table (business-specific)
    - Displayed as colored chips (same styling as staff selection)
    - At least one service must be selected before saving
    - Selected services are stored in `public.appointment_services` junction table
    - Service names are used for the appointment title
  - **Amount field** - Enter service price with currency symbol prefix:
    - Currency symbol automatically updates based on user's currency setting
    - Numeric input only
    - Amount contributes to Analytics revenue calculations
  - Add optional notes
  - **Recurring Appointments (Series)** - Create repeating appointments:
    - **Repeat Toggle** - Enable to create a series of appointments
    - **Frequency Options**:
      - Weekly - Same day every week
      - Every 2 Weeks (Biweekly)
      - Monthly - Same date each month
      - Custom - Choose interval in weeks
    - **End Conditions**:
      - After # times - Specify number of occurrences (e.g., 4, 8, 12)
      - On date - Set an end date for the series
    - **Preview** - See all scheduled dates before creating:
      - Shows total appointments to be created
      - Highlights any conflicts (staff double-booked, store closed)
      - Conflicts are automatically skipped
    - **Conflict Handling**:
      - Respects store business hours
      - Respects blackout dates (store closed)
      - Prevents staff double-booking
      - Option to skip conflicting dates
    - **Recurring Badge** - Purple badge shows "Recurring" on series appointments
    - **Database**: `appointment_series` table stores series metadata:
      - Links individual appointments via `series_id` column
      - Tracks occurrence index for ordering
      - Supports active/paused/cancelled status
- **Segmented control** in Clients section to switch between Clients and Calendar views
- **Monthly calendar view** with clean, minimal design
- Visual indicators for days with scheduled appointments
- **Today highlighting** - Current date clearly visible
- **Quick navigation** - Navigate between months with arrow buttons, tap month to return to today
- **Create appointments** - Tap + button to schedule new appointments:
  - Select date from calendar
  - Search and select existing client
  - Set start and end time
  - Add optional title and notes
- **View appointments** - Tap on a date to see all appointments for that day
- **Appointment details** - View full appointment info with client, time, and notes
- **Delete appointments** - Remove appointments from the details view
- **Feature toggle** - Enable/disable in Settings → Features:
  - When OFF: Calendar tab hidden, Appointments button hidden from Quick Actions
  - When ON: Segmented control appears with Clients | Calendar tabs, Appointments visible
  - Perfect for businesses that don't need scheduling (retail, food service)

### Tags
- Create custom color-coded tags for any business type
- Users can enter any text for tag names without limits
- Unlimited tags can be created
- Colors can be reused across multiple tags
- Apply tags to clients and visits
- Edit and delete tags
- 16 preset colors to choose from

### Settings
- Profile overview
- **Editable Business Name** - Tap to edit and update business name
- **Editable Email Address** - Tap to edit and update email
- **Business Address** - Required for email campaigns with country-specific legal compliance
  - Country selection with flags (76 countries supported)
  - State selection for USA (alphabetical, required for US legal compliance)
  - Email footer language selection (18 languages)
  - Auto-populates currency based on country selection
- Membership status display
- **Features** - Toggle optional features on/off:
  - Appointments / Calendar - Enable scheduling functionality
  - **Dark Mode** - Optional dark theme for reduced eye strain in low-light environments
    - Light Mode is the default experience
    - Dark Mode is user-controlled (opt-in only)
    - Fully global theme that applies to all screens including Send Email
    - Persists across app restarts
    - Switch color matches selected theme color
- **Booking Page Language** - Configure languages for public booking pages:
  - Multi-select list to enable/disable languages for the booking page
  - English is always enabled (marked as "Required" with lock icon)
  - **English Required Explanation** - Localized tooltip explains that English is kept as a backup fallback, not forced on all visitors
  - 16 additional languages available: Spanish, French, German, Portuguese, Italian, Dutch, Swedish, Norwegian, Danish, Finnish, Russian, Turkish, Japanese, Korean, Chinese
  - **Smart Language Detection** toggle - Automatically matches customer's device language
  - **Default Booking Language** picker - Fallback when customer's language isn't enabled
  - Settings accessible even when Appointments feature is OFF (with info note)
  - Clean, premium multi-select UI with checkmarks (no toggles per language)
  - **Smooth switch animation** - Toggle animates cleanly without bouncing or stuck states
  - **Proper persistence** - Save only shows "Saved" after successful database write; shows error if save fails
  - Smooth UI transitions and real-time saving
  - **Full localization** - All UI text (headers, labels, descriptions) translates based on app language
  - **Public Booking Page i18n** - Full multilingual support on the public booking page:
    - Language detection priority: URL param (?lang=es) → localStorage → browser/device locale → default locale → English
    - Language selector shown only when multiple languages are enabled
    - Language changes saved to localStorage for persistence across visits
    - URL updated with lang param when language is changed
    - All booking steps use the active language (services, staff, date/time, confirmation)
    - **Service name translations** - Common service names (Haircut, Manicure, Massage, etc.) automatically translate to the selected language
    - Missing translation keys fall back to English (page never breaks)
    - Preview Booking Page behaves identically to the public booking link
- **Booking Link & QR** - Share your booking page with customers:
  - QR code generation for your booking URL
  - **Tappable booking URL** - Tap the URL to open in external browser (Safari/Chrome)
  - **Opens in external browser** - Always opens public booking page without requiring app login
  - **Copy Link** - Copy booking URL to clipboard
  - **Share** - Native share sheet integration
  - **Download QR** - Save QR code as PNG image
  - **Download Flyer** - Generate printable PDF flyer with business name, QR code, and booking URL
  - **Email to Me** - Send booking link with QR attachment to your own email
  - **Language Link Builder** - Create links that force a specific language:
    - Default link (auto-detects language)
    - Forced language links (e.g., ?lang=es for Spanish)
    - Shows only languages you've enabled in Booking Page Language settings
  - **Preview Mode Support** - Automatically uses preview URL when custom domain not configured
  - **Localized Error Messages** - All error messages fully translated in 18 languages
  - Full localization support (18 languages)
- **Primary Location (Business Information)** - Settings for your default business location:
  - Renamed from "Business Information" to "Primary Location"
  - Subtitle: "Used for Online Booking and as your default store info"
  - **Physical Address** - Required for email campaigns
  - **Phone Number** - Supports global formats with auto-formatting for US numbers
  - **Country & State** - For legal compliance and currency detection
  - **Business Hours** - Configure operating hours for Online Booking:
    - Set different hours for each day of the week (Mon-Sun)
    - Mark days as closed with toggle switch
    - "Apply to all days" button for quick setup
    - Hours saved to Supabase `business_hours` table
    - Default hours if not set: Mon-Fri 9AM-5PM, Sat 10AM-4PM, Sun Closed
    - Tip displayed: "Hours are only required if you plan to use Online Booking"
  - **Email Footer Language** - Choose language for email campaign footers
  - Footer preview shows how emails will appear
- **Main Store** - Settings screen for primary business location:
  - Labeled "Main Store" (translated in all 18 languages)
  - Set business address and phone number
  - **Auto-Sync**: Saving Main Store info automatically updates the primary store in Stores & Staff
  - Used for Online Booking and as default store info
- **Stores & Staff** - Unified management screen with 2 tabs:
  - **Stores Tab** - Manage multiple locations:
    - Add, edit, and delete stores/locations
    - **Store Photos** - Upload circular photos for each store:
      - Same premium upload system as Staff photos and Business logo
      - Max 10MB original, compressed to 512x512 (300KB max) + 128x128 thumbnail
      - Photos displayed left of store name in Settings and Public Booking Page
      - Supports JPG, PNG, HEIC formats
      - Stored in Supabase `store-photos` bucket
    - **Main Store (Primary) Protection** - The primary store cannot be deleted:
      - **Protected visual styling** - Crown icon with golden amber border (like Staff Access owner)
      - Staff count displayed in standard text color (same as other stores)
      - Delete button completely hidden for primary stores (no trash icon)
      - Reorder controls hidden for primary store (always stays at top)
      - Backend enforcement via database trigger (bulletproof protection)
      - Renaming primary store allowed (edit only, not delete)
      - Primary store always appears first in all lists across the app
      - Address/phone synced from Settings > Main Store
    - **Consistent Store Ordering** - All store lists use the same order everywhere:
      - Primary store always first (is_primary DESC)
      - Then all other stores by creation date, oldest first (created_at ASC)
      - Applies to: Stores & Staff, Appointments dropdown, Staff Calendar tabs, Analytics filters, Bulk Email filters
    - View staff count per store
    - **Delete Confirmation** - Clear confirmation dialog before deleting non-primary stores:
      - Title: "Delete Store?" (localized in 18 languages)
      - Body: "This cannot be undone." (or staff unassignment warning if applicable)
      - Increased spacing between edit and delete buttons to prevent accidental taps
    - **Reorder Stores** - Use up/down arrows to change store display order (non-primary stores only):
      - Order is persisted in database (`sort_order` column)
      - Reflects everywhere stores are shown (Staff Calendar tabs, etc.)
      - Survives app restart
    - **Tappable Store Cards** - Tap any store to view assigned staff:
      - Opens modal with store icon + name header
      - Shows list of staff assigned to that store
      - Same card style as Staff tab (avatar/initials, name, color dot)
      - Empty state message if no staff assigned
      - Edit/delete buttons still work independently (with stopPropagation)
    - Staff members can be assigned to multiple stores
    - **Special Hours / Exceptions** - Date-specific overrides for store hours:
      - Set custom hours for specific date ranges (holidays, special events)
      - Multi-day range support (e.g., 1-week holiday closure with one rule)
      - Mark store as fully closed for date ranges
      - Optional note field for context (e.g., "Christmas closure", "Extended summer hours")
      - iOS-style spinner pickers for dates and times (consistent with Log Visit)
      - Validation: end date >= start date, close time > open time (unless closed)
      - Stored in Supabase `store_hours_overrides` table with RLS policies
      - **Booking integration**: Overrides take priority over weekly business hours
        - If override exists for date + store and is_closed=true: no time slots shown
        - If override exists with custom times: slots generated from override hours
        - If no override: uses regular weekly business hours
      - Same centered "Saved" toast with sound/haptic feedback as Log Visit
  - **Staff Tab** - Manage team members:
    - **Store Filter** - Filter staff list by store (horizontal pill selector):
      - "All Stores" pill shows all staff members
      - Individual store pills filter to show only staff assigned to that store
      - Premium styling with theme colors (selected pill uses brand primary color)
      - Empty state message when no staff at selected store
    - **Staff Hours** - Full availability management for each staff member:
      - Visible in both Add Staff and Edit Staff modals
      - Positioned directly below the Services section
      - In Add mode: displays the UI for configuration (saved when staff is created)
      - In Edit mode: saves changes directly to the database
      - **Weekly Schedule** - Set regular working hours for each day of the week:
        - 7 rows (Sunday–Saturday) with time pickers for start/end time
        - "Off" toggle to mark days as unavailable
        - "Apply to All Days" button for quick setup
        - Saved to Supabase `staff_weekly_schedule` table
      - **Special Days** - Override hours for specific dates:
        - Add/edit/delete single-date overrides (holidays, events, etc.)
        - Each day can be "Off" or have custom hours
        - Optional note field for context
        - Stored in Supabase `staff_special_days` table
      - **Blackout Dates** - Block datetime ranges when staff is unavailable:
        - Add/edit/delete blackout periods (vacation, leave, etc.)
        - Start and end datetime pickers
        - Optional note field
        - Stored in Supabase `staff_blackout_ranges` table
      - Controls Online Booking availability independently from store hours
      - Same UI aesthetics as Store schedule (cards, spacing, typography)
      - Full dark/light mode support with theme colors
      - "Show All Staff" button to reset filter
      - Translations in all 18 languages
    - Add, edit, and archive staff members (persisted to Supabase)
    - Assign staff to stores
    - **Staff Photo Upload** (Premium Feature) - Upload professional photos:
      - Supports JPG, PNG, HEIC formats (max 10MB original)
      - On-device compression: Full image (512px, max 300KB), Thumbnail (128px, ~30KB)
      - Stored in Supabase Storage (`staff-photos` bucket)
      - Path format: `staff/{businessId}/{staffId}.jpg` and `staff/{businessId}/{staffId}_thumb.jpg`
      - Thumbnails used in staff lists and booking page for fast loading
      - Full images displayed in staff detail/edit views
      - Remove photo option with confirmation and automatic cleanup
      - Upload progress indicator during save
      - Sets all photo fields: `photo_url`, `avatar_url`, `avatar_thumb_url`
    - **Services (Skills) Selection** - Multi-select services each staff member can perform
    - Staff can only be booked for services they're skilled in
    - Color-coded staff avatars with initials (fallback when no photo)
    - **18-color palette** matching Services for visual consistency
    - Colors are fully reusable (no limits on how many staff share a color)
    - Success toast with checkmark shown after save
- **Services & Products** - Dedicated management screen for service offerings:
  - Add, edit, and soft-delete services (persisted to Supabase)
  - **Service Description (Optional)** - Add detailed description for services:
    - Multiline text field in Create/Edit Service modal
    - Description displayed via info indicator on Public Booking Page
    - Tap info icon to view full description in modal
    - No indicator shown if description is empty
  - **Service Type Selector** - Choose between:
    - **Service** (appointment-based) - Requires duration, shows in booking flow
    - **Product** (no time required) - For add-ons or retail items, NOT shown in booking flow
  - **Products Hidden in Booking** - Product-type services do NOT appear in:
    - Online booking page
    - Book Appointment modal
    - Log Visit modal
  - **Duration** - Required for services (5-480 minutes), auto-set to 0 for products
  - **Price** - Set price in business currency (auto-derived from business country)
  - **Price Auto-Population** - When services are selected in Book Appointment or Log Visit:
    - Total price automatically calculated from selected services
    - Amount field auto-populated (no manual entry needed)
  - **Currency Auto-Detection** - Currency symbol and code automatically match business country
  - **18-color palette** matching Staff for visual consistency
  - Colors are fully reusable (no limits on how many services share a color)
  - Success toast with checkmark shown after save
  - **Resilient Save** - Handles missing database columns gracefully (retries without optional fields)
- **Staff Calendar** - Premium staff scheduling and calendar management:
  - **Visual Weekly Calendar Grid** - See all staff shifts at a glance:
    - Time column on left (6am-9pm)
    - Days of week as columns (Mon-Sun)
    - Color-coded shift blocks per staff member
    - Tap any cell to add a new shift
    - Tap existing shift to edit/delete
  - **Auto-Reflects Store Hours** - Calendar automatically shows store schedule:
    - **Regular Weekly Hours** - Calendar respects store's weekly hours
    - **Special Hours** - Override days display with special hours indicator (yellow)
    - **Blackout Dates** - Closed days show red "CLOSED" indicator
    - Cannot create shifts on closed days (alert shown)
    - Shift times default to store's open/close hours
  - **Week Range Selector** - Quick view controls:
    - "This Week" - View current week only
    - "2 Weeks" - View two weeks at a time
    - "3 Weeks" - View three weeks at a time
    - Closed days and special hours reflected across entire range
  - **Auto-Schedule** - Fast bulk shift creation:
    - Multi-select staff members to schedule
    - Auto-creates shifts based on store hours
    - Respects Special Hours (uses override times)
    - Skips Blackout Dates (no shifts created)
    - Existing shifts are preserved (won't overwrite)
    - "Select All" and "Clear" quick actions
    - Shows summary: X weeks, Y open days
    - Individual shifts can still be fine-tuned after
  - **Staff Avatar Selector** - Circular avatars with visual highlighting:
    - Filter calendar view by selected staff
    - Shows which staff have shifts scheduled
    - Multi-select filtering support
  - **Week Navigation** - Browse past and future weeks:
    - Previous/Next week arrows
    - Tap center to jump to current week
    - "Current" indicator shown when viewing current week
  - **Store Selector** - Multi-store support:
    - Filter shifts by store location
    - Each store has independent schedules
    - Staff can have different hours at different stores
    - Store hours automatically loaded for selected store
  - **View Modes** - Toggle between views:
    - **Calendar Grid** - Visual timeline view
    - **List View** - Staff-grouped summary with shift details
  - **Shift Management**:
    - Create new shifts with staff/day/time selection
    - Edit existing shifts (update times)
    - Delete shifts with confirmation
    - Validation prevents overlapping times
    - **Lunch Break Support** - Optional break period within each shift:
      - Set break start/end times (e.g., 13:00-14:00)
      - Staff unavailable during break period
      - Validation ensures break is within shift hours
      - Persisted in database for availability calculations
    - **Staff filtered by selected store** - Only staff assigned to the current store tab are shown
    - Empty state handling with helpful guidance when no staff assigned to store
    - **Real-time sync with Settings** - Staff assignments made in Settings > Staff automatically reflect in Staff Calendar without app restart
  - **Quick Actions**:
    - **Auto** - Opens Auto-Schedule modal for bulk shift creation
    - **Copy Week** - Duplicate previous week's schedule
    - **Apply Defaults** - Apply staff's weekly schedule template
  - **Share Calendar** - Multiple sharing methods:
    - Native share sheet (Messages, Email, etc.)
    - Formatted weekly summary text
    - Filter by selected staff before sharing
  - **Database**: `staff_calendar_shifts` table with:
    - Week-based storage (week_start_date)
    - Store-specific shifts (store_id)
    - **Break time columns** (break_start, break_end) for lunch/break periods
    - Unique constraint prevents duplicate shifts
    - RLS policies for business-level isolation
    - **Staff-store assignments**: Uses `staffService.getStaffForStore()` as the **single source of truth** for staff-store linking:
      - Same logic as Settings > Stores & Staff (exact same function)
      - Checks `store_staff` table (`staff_id` + `store_id`)
      - Checks `staff_store_assignments` table (`user_id` OR `staff_id` + `store_id`)
      - Ensures Staff Calendar shows identical staff assignments as Settings
    - RPC provides shifts only; staff list is always fetched from `staffService` for consistency
  - **Integration**: Works with existing scheduling system:
    - Respects staff_blackout_ranges (vacation blocks shifts)
    - Respects staff_special_days (date overrides)
    - Falls back to staff_weekly_schedule (default template)
- **Booking Logic Integration** - Staff filtering based on skills:
    - Public booking page filters available staff by selected service
    - Uses `staff_services` junction table for skill mapping
    - Backwards compatible: shows all staff if no skills configured
  - Staff member avatars display with the user's selected theme color
  - Staff initials show first+last name initials (e.g., "John Smith" → "JS")
  - If only first name exists, shows single initial (e.g., "Maria" → "M")
  - Full multi-language translation support for all text
  - **Default Store Name Localization** - "Main Store" is fully localized:
    - Automatically detects default store names in any language (even if stored in DB as English)
    - Displays in user's current language: Spanish → "Tienda Principal", French → "Magasin Principal", etc.
    - Translations for all 18 supported languages
    - Re-renders correctly when language is switched
    - Uses `getLocalizedStoreName()` utility for consistent display across all screens
  - **Multi-Store Login** - Same credentials work across all store locations:
    - Staff can log in with the same username/password at any store
    - Data is shared across all locations for the same account
    - Perfect for businesses managing multiple locations with shared staff
  - When viewing appointments, filter by store to see only that store's appointments
  - Store filter automatically shows only staff assigned to that store
  - New appointments are automatically linked to the selected store
  - Perfect for businesses with multiple locations (e.g., "Downtown Location", "Mall Location")
- **Tags** - Manage service tags for categorizing clients and services:
  - Same visual design as Stores & Staff section
  - Icon with theme-colored background matching other settings items
  - Description text with "Manage your tags to categorize clients and services"
  - Opens dedicated Tags management page
  - Create, edit, and delete custom tags
  - Unique colors for each tag (12 colors available)
  - Full multi-language translation support (18 languages)
- Language toggle (English/Spanish/French/Portuguese/German/Russian/Turkish/Chinese/Korean/Japanese/Swedish/Norwegian/Danish/Finnish/Icelandic/Dutch/Italian)
- Export data via email
- Service tags management (now called "Tags" with optional type categorization)
- **Theme Colors** - Customize app appearance with full i18n support:
  - Primary Color selection (headers, accents, highlights)
  - Button Color selection (action buttons throughout app)
  - 10 color options: Teal, Blue, Purple, Pink, Red, Orange, Amber, Emerald, Indigo, Slate
  - Live preview section showing header and button appearance with centered, bold text
  - All labels and color names automatically translate to user's selected language
  - Compact layout optimized to fit on mobile screens
- **Legal Documents** - Access all legal documents directly from settings
- **Help Center** - Comprehensive FAQ and support section:
  - Searchable FAQ with keyword matching
  - Six expandable categories:
    1. Getting Started (Sign up, Login, Navigation)
    2. Account & Security (Face ID, Change Password, Logout)
    3. App Features (Appointments, Clients, Promotions, Analytics, Export Data, Drip Campaigns, Bulk Email)
    4. Customization (Theme Colors, Dark Mode, Language, Sounds & Vibrations)
    5. Data & Privacy (Privacy Policy, Terms, Cookies, Data Storage)
    6. Troubleshooting (App issues, Data sync, Contact support)
  - Step-by-step instructions for each topic
  - Contact Support button with direct email link
  - Full localization in all 18 supported languages
  - Animated expand/collapse with spring physics
  - Search filters results across all categories
- Logout

### Legal & Compliance System

**Fully compliant with US Federal Law, Florida State Law, Apple App Store Guidelines, and Google Play Policies. Legal text is written in a user-friendly, clear, and non-intimidating tone while maintaining full legal protection.**

**Multi-language Legal Support:**
- All legal documents available in English, Spanish, French, Italian, Dutch, Russian, Turkish, Danish, Swedish, Icelandic, Finnish, Norwegian, Haitian Creole, Korean, Portuguese, Japanese, Simplified Chinese, and German
- Friendly, approachable tone across all languages
- Same legal protection maintained in all language versions

#### Mandatory Terms Acceptance
- **Full-screen modal** on first launch and account creation
- Requires explicit checkbox consent before continuing
- Checkbox text: "I have read and agree to the Terms of Service, Legal Disclaimer, Privacy Policy, and Arbitration Agreement"
- Continue button disabled until checkbox is checked
- User cannot access any app features without acceptance

#### Legal Documents Included (10 Sections - Alphabetically Ordered)
- **Arbitration Agreement** - Explains how disputes are resolved through arbitration
- **Biometric Authentication (Face ID / Touch ID)** - Clear explanation of how biometric data stays on device
- **Data Storage** - Explains how data is stored with trusted cloud providers
- **Device Limit** - Explains the 3-device limit in simple terms
- **Indemnification** - User responsibility explained in plain language
- **Legal Disclaimer** - Explains that DataBase is a helpful tool, with realistic expectations
- **Limitation of Liability** - Clear explanation of liability limits
- **Maximum Liability** - Explains the $20 liability cap in straightforward terms
- **Privacy Policy** - Easy-to-understand explanation of data handling and user rights
- **Terms of Service** - Welcoming introduction with clear guidelines for using the app
- **Use at Your Own Risk** - Explains responsibilities in a helpful, non-intimidating way
- **Cookie Policy** - Explains local storage usage in plain language

#### Terms Acceptance Requirements
- **Sign-up / Account Creation** - Users must accept all Terms & Conditions via checkbox before creating account
  - Face ID privacy notice displayed on sign-up (iOS only)
  - Clear disclosure that biometric data stays on device
- **Membership Purchase / Renewal** - Users must accept all Terms & Conditions via checkbox before subscribing
- **Settings Access** - Terms & Conditions remain accessible in Settings at all times
- **Face ID Toggle** - Consent description displayed when enabling Face ID:
  - "Use Face ID for faster login. By enabling, you consent to using biometric data stored securely on your device."

#### Store Compliance Language
- Clear "tool to help your business" messaging
- Realistic expectations about results depending on usage
- No prohibited language or misleading promises

#### Arbitration & Class Action Waiver
- Disputes resolved through individual arbitration
- Clear explanation of what this means
- Option to opt out within 30 days
- Compliant with Federal Arbitration Act (FAA)

#### Acceptance Logging (Audit Trail)
- User ID
- Timestamp
- App version
- Device OS
- Explicit consent flag
- All records persisted and retrievable for legal audits

#### Terms Update Re-Acceptance
- When terms version changes, users must re-accept
- Modal shows "Updated Terms" with version change notification
- Existing acceptance records preserved for audit trail

#### Settings Integration
- Legal documents accessible anytime from Settings
- Clear section with all 7 legal documents
- Privacy Policy and Cookie Policy as expandable menu items
- Version and last updated date displayed
- Contact email for legal questions
- **Professional Footer** - Company info at bottom of Settings:
  - © 2026 Database LLC, Miami, United States
  - Made in USA
  - Support contact email and phone number
  - Version number with quick links to Privacy and Cookie policies

#### Subscription Checkout Reinforcement
- Legal confirmation component for subscription screens
- Text: "By subscribing, you confirm that you agree to the Terms of Service, Legal Disclaimer, and Arbitration Agreement"
- Clickable links to documents
- Tool disclaimer included

### Internationalization
- Full English/Spanish/French/Portuguese/German/Russian/Turkish/Chinese/Korean/Japanese/Swedish/Norwegian/Danish/Finnish/Icelandic/Dutch support
- Language toggle in settings
- Language display names shown in their native language:
  - English: "English"
  - Spanish: "Español"
  - French: "Français"
  - Portuguese: "Português"
  - German: "Deutsch"
  - Russian: "Русский"
  - Turkish: "Türkçe"
  - Chinese Simplified: "中文"
  - Korean: "한국어"
  - Japanese: "日本語"
  - Swedish: "Svenska"
  - Norwegian: "Norsk"
  - Danish: "Dansk"
  - Finnish: "Suomi"
  - Icelandic: "Íslenska"
  - Dutch: "Nederlands"
- **Full Language Consistency** - When a language is selected, ALL text appears only in that language:
  - No mixing of English with other languages
  - Marketing Promotions page fully localized (discount descriptions, form labels, hints)
  - All buttons, labels, and placeholders dynamically adjust for longer words
  - Text overflow handled with auto-sizing and 2x2 grid layouts
- Complete translations including:
  - All UI elements and labels
  - All legal documents (Terms, Privacy Policy, etc.)
  - All drip campaign consent texts
  - All GDPR compliance texts
  - All notifications and error messages
  - All empty states and placeholders
  - All subscription and trial system content
  - **Membership section** - Plan type, dates, and prices fully localized
  - **Marketing Promotions** - All form fields, hints, and discount types translated
- **Localized Date Formatting** - All dates (membership start, expiration, etc.) formatted according to selected language locale
- **Localized Price Formatting** - Currency display formatted according to user's language/region preferences
- Language selection persists across all views and sessions
- **Instant Updates** - Changing language immediately updates all text, dates, and prices without requiring page refresh

### 7-Day Free Trial & Subscription System

**Complete trial and subscription system with paywall enforcement.**

#### Free Trial (7 Days)
- Trial starts immediately upon account creation (not first login)
- Full unrestricted access to all app features during trial
- No paywalls or limitations during trial period
- Trial end date stored securely and persists across sessions and devices
- Trial status cannot be reset by logging out and back in

#### Trial Countdown Banner
- Persistent but non-intrusive banner appears 48 hours before trial ends
- Shows time remaining (hours or days)
- Urgent styling (red) when less than 24 hours remain
- One-tap access to upgrade screen
- Dismissible but reappears on next session
- Visible on dashboard and key pages

#### Post-Trial Paywall
- Full-screen subscription paywall overlay when trial expires
- Semi-dark background with app content visible but non-interactive
- Clear headline: "Your free trial has ended"
- Subheadline: "Choose a plan to continue using all features."
- Displays all available subscription plans
- Primary CTA: "Upgrade Now"
- Secondary option: "Restore Purchase"
- User cannot navigate, create data, or access any features until subscribed

#### Subscription Plans
- Monthly Plan: $25/month – cancel anytime, recurring monthly billing
- Yearly Plan: $250/year – save 2 months, billed annually, non-refundable
- Smart plan highlighting with "Best Value" and "Save 2 months" badges

#### Feature-Triggered Upsell
- Attempting high-value actions after trial expires triggers paywall:
  - Creating a client
  - Adding a visit
  - Exporting data
  - Creating campaigns
  - Sending emails
- Contextual message displayed: "This feature requires an active subscription."

#### Subscription Features Included
- Unlimited client management
- Email marketing campaigns
- Analytics & insights
- Drip campaign automation
- Priority support

#### Session Persistence
- Paywall reappears immediately if app is closed and reopened after trial expires
- Logging out and back in does not reset trial or bypass paywall
- Subscription status persists across sessions and devices

#### Platform Consistency
- Works consistently across iOS, Android, and Web
- Follows platform best practices for in-app subscriptions
- Restore purchase functionality for previously subscribed users

#### Internationalization
- Full translation support in all 18 languages (English, Spanish, French, Haitian Creole, Portuguese, German, Russian, Turkish, Chinese, Korean, Japanese, Swedish, Norwegian, Danish, Finnish, Icelandic, Dutch, Italian)
- All paywall text, banner messages, and feature blocked messages translated

## Data Structure

- **Clients**: userId (owner), name, email, phone, notes, visits, promotions, tags, drip campaign assignment, active promotion, promotion counters, archived status
- **Visits**: date, services, notes, amount, promotion used
- **Appointments**: userId (owner), clientId, date, startTime, endTime, title, notes, timestamps
- **Tags**: userId (owner), name, color
- **Drip Campaigns**: userId (owner), name, color, emails sequence, frequency, active status
- **Marketing Promotions**: userId (owner), name, description, discount type (percentage/fixed/counter), discount value, start/end dates, color, active status
- **Client Promotion Counters**: promotion reference, current count, target count, history with dates and services
- **User**: email, name, role, business name, business address, membership info, trial start date, trial end date, subscription status, subscription purchase date
- **Feature Toggles**: calendarEnabled (boolean)
- **Email Opt-Outs**: recipient email, business ID (userId), opt-out status, timestamps, registration source
- **Email Opt-Out Audit Logs**: email, business ID, action (opt_out/opt_in), timestamp, source
- **Terms Acceptance**: user ID, terms version, accepted timestamp, app version, device OS, explicit consent flag
- **Drip Campaign Acceptance**: user ID, campaign ID, accepted timestamp, app version, consent text
- **Drip Campaign Activation Logs**: user ID, campaign ID, action (activated/deactivated/blocked), timestamp, acceptance ID
- **EU Lawful Basis Acceptance**: user ID, campaign ID, accepted timestamp, app version, consent text, IP address (optional)
- **EU Campaign Activation Logs**: user ID, campaign ID, action (eu_activated/eu_deactivated), timestamp, acceptance ID, EU indicator flag

### User Data Isolation

**Complete account isolation with security-first design:**

#### Login and Authentication
- Users log in with email and password
- Deterministic user IDs generated from email (same email = same user ID always)
- After login, only data linked to that user's account is displayed
- No data from other users' accounts is ever visible

#### Data Access and Visibility
- Each user sees only their own data (clients, promotions, campaigns, service tags)
- All pages, lists, forms, dashboards, and reports filter by logged-in user
- User-filtered selectors ensure data isolation at the store level

#### Data Operations Restrictions
- All Create, Read, Update, Delete (CRUD) operations verify user ownership
- Update/delete operations silently fail if user doesn't own the data
- New data automatically tagged with current user's ID

#### Session Management
- User sessions tied to their account only
- Switching users requires full logout and new login
- Persistent data storage maintains user isolation

#### Platform Consistency
- Rules apply identically on iOS, Android, and Web
- All store queries filter by logged-in user's unique ID

### EU GDPR Compliance Layer (Additive)

**This layer ADDS EU-required safeguards without removing, weakening, or overriding any existing US/Florida protections.**

#### Scope Confirmation
- Feature remains EMAIL ONLY (no SMS, WhatsApp, push notifications, phone calls, or messaging services)
- All existing US CAN-SPAM protections remain active

#### GDPR Role Clarification
- Non-editable disclosure displayed for EU-enabled campaigns:
  - "For recipients located in the European Union, the business owner acts as the Data Controller. The platform acts solely as a Data Processor providing technical email delivery services."

#### Lawful Basis Confirmation (EU Campaigns Only)
- Additional checkbox required before activating EU-enabled campaigns:
  - "I confirm that I have a lawful basis under GDPR (such as explicit consent or legitimate interest) to send emails to EU recipients."
- Campaign activation blocked unless accepted
- Only appears for campaigns with "EU Recipients" toggle enabled

#### EU Recipients Toggle
- Toggle in campaign editor: "May include EU recipients"
- When enabled, shows GDPR compliance notice
- Requires lawful basis confirmation on activation

#### GDPR-Compliant Unsubscribe
- Existing unsubscribe system satisfies:
  - GDPR Article 21 (Right to Object)
  - ePrivacy Directive requirements
- No additional UI changes required

#### EU Legal Footer Extension
- Subtle, non-intrusive footer line for EU recipients only:
  - "You are receiving this email because the sender has identified a lawful basis under EU data protection laws."
- Same styling as existing footer
- Small font, not disruptive

#### Data Subject Rights Support (Backend)
- Platform provides backend capability for business owners to:
  - Suppress an email permanently (Right to Object)
  - Delete an email address (Right to Erasure)
  - Export email-related data (Right to Access)
- Execution remains the responsibility of the business owner

#### Platform Non-Verification (Critical)
- The platform does NOT verify EU consent
- The platform does NOT validate lawful basis
- The platform does NOT monitor GDPR compliance
- All responsibility remains with the business owner

#### EU Indemnification (Additive)
- Extends existing indemnification to include:
  - GDPR fines and penalties
  - ePrivacy Directive violations
  - Regulatory investigations by EU supervisory authorities
  - Attorney fees and legal costs in EU jurisdictions
- Supplements (does not replace) existing US indemnification

#### Acceptance Logging (EU Layer)
- Logs when EU checkbox is accepted:
  - User ID
  - Campaign ID
  - Timestamp
  - IP address (optional)
  - EU indicator flag
- Stored alongside existing logs

#### Platform Enforcement Rights
- Platform may suspend EU-targeted campaigns for suspected violations
- No duty to investigate
- No liability for enforcement decisions

## Tech Stack

- Expo SDK 53
- React Native 0.76.7
- NativeWind (TailwindCSS)
- Zustand for state management
- React Query for server state management
- React Native Reanimated for animations
- date-fns for date formatting
- Lucide icons
- **Supabase** - Backend-as-a-Service:
  - Authentication (email/password)
  - PostgreSQL database with Row Level Security
  - Real-time subscriptions (ready for future use)
  - Profile management with automatic user creation
  - **Clients** - Full CRUD with business-scoped RLS
  - **Stores** - Multi-store support with business-scoped RLS
  - **Staff** - Staff management with store assignments
  - **Appointments** - Full CRUD with:
    - Business-scoped data isolation
    - Store and staff filtering
    - Conflict detection
    - Soft delete with restore functionality
    - Date range queries (day/week/month)

### Required Supabase Tables

The app requires the following tables in your Supabase database.

**IMPORTANT:** If you see errors like "Could not find the table 'public.stores' in the schema cache", run the SQL migration in `supabase-migration.sql` to create the missing tables.

1. **businesses** - Stores business information
   - `id` (uuid, primary key)
   - `owner_id` (uuid, references auth.users)
   - `name` (text)
   - `email` (text, nullable)
   - `phone` (text, nullable)
   - `business_address` (text, nullable) - Physical address for CAN-SPAM compliance
   - `business_phone_number` (text, nullable) - Contact phone for email signatures
   - `business_country` (text, nullable) - ISO country code (e.g., 'US', 'CA')
   - `business_state` (text, nullable) - US state code for state-specific laws
   - `email_footer_language` (text, nullable) - Language for email footers
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

   **Migration:** Run `supabase-business-info-migration.sql` to add business info columns.

2. **clients** - Stores client information
   - `id` (uuid, primary key)
   - `business_id` (uuid, references businesses.id)
   - `name` (text)
   - `email` (text, nullable)
   - `phone` (text, nullable)
   - `notes` (text, nullable)
   - `visits_count` (integer, default 0)
   - `created_at` (timestamptz)

3. **stores** - Stores location information
   - `id` (uuid, primary key)
   - `business_id` (uuid, references businesses.id)
   - `name` (text)
   - `is_archived` (boolean, default false)
   - `created_at` (timestamptz)

4. **staff** - Stores staff information
   - `id` (uuid, primary key)
   - `business_id` (uuid, references businesses.id)
   - `name` (text)
   - `email` (text, nullable)
   - `color` (text)
   - `is_active` (boolean, default true)
   - `photo_url` (text, nullable)
   - `avatar_url` (text, nullable)
   - `avatar_thumb_url` (text, nullable)
   - `store_ids` (uuid[], array of store IDs, optional)
   - `service_ids` (uuid[], array of service IDs, optional)
   - `created_at` (timestamptz)

5. **appointments** - Stores appointment information
   - `id` (uuid, primary key)
   - `business_id` (uuid, references businesses.id)
   - `client_id` (uuid, references clients.id)
   - `store_id` (uuid, references stores.id)
   - `staff_id` (uuid, references staff.id, nullable)
   - `start_at` (timestamptz)
   - `end_at` (timestamptz)
   - `duration_minutes` (integer)
   - `title` (text, nullable)
   - `notes` (text, nullable)
   - `amount` (numeric, default 0)
   - `status` (text, default 'scheduled')
   - `is_deleted` (boolean, default false)
   - `created_at` (timestamptz)

## Multi-Language Support (Performance Optimized)

The app supports 18 languages with statically imported translations for instant access:
- **English** (default, always bundled)
- **Spanish** (Español)
- **French** (Français)
- **Haitian Creole** (Kreyòl Ayisyen)
- **Portuguese** (Português)
- **German** (Deutsch)
- **Italian** (Italiano)
- **Dutch** (Nederlands)
- **Swedish** (Svenska)
- **Norwegian** (Norsk)
- **Danish** (Dansk)
- **Finnish** (Suomi)
- **Icelandic** (Íslenska)
- **Russian** (Русский)
- **Turkish** (Türkçe)
- **Chinese** (中文)
- **Korean** (한국어)
- **Japanese** (日本語)

### Performance Optimizations

- **Static Imports**: All translations are bundled and available synchronously
- **Instant Switching**: Language changes update UI immediately without loading delays
- **Direct Lookup**: `t()` function uses direct synchronous lookup from static map
- **No Cache Race Conditions**: Translations work correctly even during language restoration from storage
- **Zero Async Overhead**: No promises or loading states needed for translations
- **Adaptive Text Layout**: Text automatically adjusts to prevent overflow in all languages
- **Font Size Adaptation**: Labels and buttons scale down for longer translations

### Language Selection UI (Improved)
- **Clean Modal Design**: Wider modal (90%, max 360px) with better readability
- **Scrollable List**: Handles many languages on all screen sizes
- **Visual Feedback**: Haptic feedback and checkmark for selected language
- **Readable Font Size**: 17px with proper line height for all scripts
- **No Text Truncation**: All text elements use numberOfLines and adjustsFontSizeToFit to prevent overflow

## Design

- Color Palette: Teal primary (#0D9488), Orange accent (#F97316)
- Clean, modern iOS-inspired design
- Smooth animations and transitions
- Mobile-first responsive layout
- **Universal Success Toast** - Consistent confirmation animation across the entire app:
  - Displays a centered modal with animated checkmark icon
  - Checkmark color matches the accent color selected in Settings
  - Background respects light/dark mode automatically
  - Smooth scale-in + fade-in animation, then fade-out
  - Auto-dismisses after ~1 second (no user interaction required)
  - Triggered on all save/update/confirm actions (appointments, calendar, client edits, settings, etc.)
  - Single reusable component via global ToastProvider context

### Audio & Haptic Feedback System
- **SoundManager** - Global singleton for playing subtle UI sounds:
  - `success.wav` - Plays on save/update/create/confirm actions
  - `toggle.wav` - Plays when toggling switches ON/OFF
  - `error.wav` - Plays on validation errors or failed actions
  - Sounds bundled as WAV assets for reliable cross-platform playback
  - Respects user's "Sounds" toggle in Settings (ON by default)
- **HapticManager** - Lightweight singleton for micro-haptic feedback:
  - Success haptic (light tactile confirmation) for save/update/create
  - Toggle haptic (micro tap) for switch ON/OFF
  - Error haptic (warning feedback) for errors
  - Uses expo-haptics for iOS native feel
- **Combined Feedback Functions**:
  - `feedbackSuccess()` - Sound + haptic for confirmations
  - `feedbackToggle()` - Sound + haptic for toggles
  - `feedbackError()` - Sound + haptic for errors

## Public Booking Website

A complete public-facing booking website for customers to schedule appointments without requiring an account.

### URL Structure
- **Main URL**: `https://rsvdatabase.com/{business-slug}` (e.g., `https://rsvdatabase.com/mcdowells`)
- **Preview URL**: When custom domain is not configured, uses Vibecode backend URL (e.g., `https://preview-xxx.vibecode.run/{business-slug}`)
- **Slug Format**: Business name in lowercase with spaces replaced by hyphens (e.g., "Barber Love" → `barber-love`)
- **Clean URLs**: No random IDs, no platform names, no visible query parameters
- **Language Preference**: Language selection is handled internally (not shown in URL to users)
- **Preview Mode Notice**: App shows localized message when using preview URL instead of production domain

### Booking Flow (Customer Experience)
1. **Landing** - Business name, welcome message, "Book Appointment" button
2. **Store Selection** (if multiple stores) - Choose which location to visit. Auto-skipped if only 1 store.
3. **Service Selection** - List of active services with **actual duration** and **price in business currency** (e.g., £65 for UK, €50 for Germany). Currency is automatically derived from business country setting. **Store→Service filtering**: Only shows services that have at least one qualified staff member at the selected store.
4. **Staff Selection** (filtered) - Shows only staff assigned to the selected store AND selected service (strict intersection). Choose specific staff or "Any Available". Staff display with initials fallback when no photo. Uses junction tables (`store_staff` and `staff_services`) for accurate filtering.
5. **Date & Time** - Calendar view with **smart time slot generation**:
   - Uses business hours configured per day of week (from `business_hours` table)
   - Defaults to 9 AM - 5 PM if no business hours configured
   - Shows "Closed on this day" message for days marked as closed
   - Generates **15-minute interval** slots — slot start times every 15 min (11:00, 11:15, 11:30, 11:45…)
   - **Full service-duration fit enforced**: a slot is shown ONLY if `slot_start + service_duration <= window_end`
   - Filters out past time slots when booking for today
   - Service duration determines which slots are available (e.g., 120-min service won't show any slot near closing if the full 2h can't fit)
6. **Customer Details** - Name (required), email (required), phone (optional with auto-format), notes (optional)
   - **Phone Auto-Format**: Automatically formats phone as XXX XXX XXXX while typing (US format)
   - Supports international numbers (+ prefix preserved)
   - Stores normalized digits in database for consistent matching
7. **Review & Confirm** - Summary of location, service, staff, date/time before confirming
8. **Success Confirmation** - Shows checkmark overlay (same style as Log Visit), then displays:
   - Confirmation code prominently in brand color
   - **Center-aligned appointment details**: Service name, date/time, duration
   - **Consistent calendar buttons**: All buttons use business theme color
   - **Share button**: Opens native share sheet (Web Share API) or copies to clipboard
   - **Download button**: Opens printable PDF confirmation page in browser

### Multi-Language Support
- **18 languages supported**: English, Spanish, French, German, Portuguese, Italian, Dutch, Swedish, Norwegian, Danish, Finnish, Icelandic, Russian, Turkish, Chinese, Korean, Japanese, Haitian Creole
- **Smart Language Detection** - Automatically uses customer's browser/device language when enabled
- **Language Switcher** - Globe icon in header allows customers to change language
- **Clean UI** - Language selection shows native names only (e.g., "Español", "Français") without technical codes
- **Locale Resolution Priority**:
  1. User's language selection in the app
  2. Device language (if smart detection enabled and language is enabled)
  3. Default locale from settings
  4. English fallback

### Features
- **Mobile-first Design** - Optimized for phones and tablets
- **Dark Mode Support** - Respects system theme
- **Real-time Availability** - Slots update based on existing appointments
- **Conflict Prevention** - Double-booking protection at database level
- **Confirmation Codes** - 6-character unique codes for tracking
- **Calendar Integration** - Consistent, themed calendar export buttons on confirmation:
  - Google Calendar - Opens with pre-filled event details (uses business theme color)
  - Outlook Calendar - Opens Outlook.com calendar with event (uses business theme color)
  - Apple Calendar (.ics) - RFC5545-compliant file download (uses business theme color)
- **Share & Download Actions**:
  - Share button - Native share (Web Share API) or clipboard copy with appointment details
  - Download button - Opens printable HTML confirmation page with PDF print option
- **No Account Required** - Customers book without signing up
- **Premium Confirmation Emails** - Branded HTML emails via Resend API sent for BOTH online and staff-created bookings:
  - **Unified Email Flow** - Same template and branding used for online bookings and staff-created/edited/cancelled appointments
  - **Staff Booking Emails** - `POST /api/appointments/notify` backend endpoint fetches all data server-side and sends the right email:
    - `created` → confirmation email
    - `updated` → rescheduled email
    - `cancelled` → cancellation email
  - **Triggered From** - BookAppointmentModal (create), AppointmentsScreen (edit/cancel), ClientDetailScreen (visit edit, appointment edit)
  - **Fire-and-Forget** - Email failure never blocks the booking action; errors are logged only
  - **Dynamic Theme Color** - Header and calendar buttons use business's brand color from Settings
  - **Business Branding** - Logo (if available) and business name prominently displayed in header
  - **Personalized Greeting** - Addresses customer by first name (e.g., "Dear John,")
  - **Premium Copy** - Warm, professional tone with elegant intro and closing
  - **Four Calendar/Action Buttons** - Google, Outlook, Apple Calendar, and Share (all use theme color)
  - **Share Button in Email** - Opens a web page with PDF generation and native share sheet support
  - **18 Language Support** - Full multilingual templates matching booking page languages
  - **Proper Business Name** - Dynamic placeholder replacement throughout email
  - **Pricing Breakdown in Email** - When pricing is available, confirmation emails include:
    - Subtotal (when discount applied)
    - Discount with promo name (e.g., "Discount (Summer10%): -$5.00")
    - Final total (shows "Free" when total = $0 from free_service promo)
- **Transactional Emails** - Automatic event-driven emails for loyalty/gift card/promo events:
  - `loyalty_points_earned` — sent when points awarded after a visit (wired in BookAppointmentModal)
  - `loyalty_points_redeemed` — sent when client redeems a reward (wired in ClientDetailScreen)
  - `gift_card_issued` — sent when gift card created for a linked client (wired in GiftCardScreen)
  - `gift_card_redeemed` — sent when a gift card is used (wired in useRedeemGiftCardValue + useRedeemGiftCardService)
  - `promotion_applied` — sent when a promo discount is applied to a booking or visit (BookAppointmentModal + AddVisitModal)
  - `promotion_counter_reward` — sent when a counter milestone is reached (ClientDetailScreen)
  - Per-event toggles (ON/OFF, default all ON) stored in `business_notification_settings` table
  - Toggle UI: Settings → Email Templates → Notification Emails section (EmailTemplatesSettings.tsx)
  - Routes: `POST /api/transactional/notify`, `GET/PUT /api/transactional/settings/:businessId`
  - Mobile service: `mobile/src/services/transactionalEmailService.ts` — fire-and-forget
  - Settings service: `mobile/src/services/notificationSettingsService.ts`
  - **Migration required**: run `backend/supabase/migrations/20260220300000_business_notification_settings.sql`
- **CRM Integration** - Online bookings properly sync to CRM:
  - **Client Matching** - Matches existing clients by email (primary) or phone (secondary)
  - **Auto Client Creation** - Creates new client record if no match found
  - **Appointment Linking** - Links appointment to client_id for proper CRM display
  - **Source Tracking** - Marks appointments/clients with "online_booking" source
  - **Immediate Visibility** - Bookings appear instantly in Appointments > Today, Calendar, and Client Details
  - **Upcoming Appointments Modal** - Auto-populates all fields from online bookings via LEFT JOINs:
    - Store name from joined `stores` table (shows name even when local store lookup fails)
    - Staff name from joined `staff` table (prefers `full_name` over `name`)
    - Service from joined `services` table with color and price
    - Amount from joined `services.price_cents` (converted to dollars)
    - Falls back to direct columns (`service_name`, `service_price`) and `appointment_services` junction table
- **Preview Mode with Fallback** - Booking always works even if custom domain DNS isn't configured:
  - Automatically uses Vibecode backend URL when custom domain unavailable
  - Shows localized "Custom domain not connected" banner in Settings > Booking Link & QR
  - Falls back to hardcoded preview URL if no backend URL available

### Business Owner Controls (in Settings)
- **Booking Page Language** - Enable/disable languages for the public page
- **Smart Language Detection** - Toggle automatic device language matching
- **Default Booking Language** - Fallback when customer's language isn't enabled
- **Booking Link & QR** - Generate shareable links and QR codes
  - **PDF Share** - Share button generates and shares a PDF file (not text) with QR code and booking URL
  - **QR Download** - Download QR code as PNG image
  - **Flyer Download** - Generate printable PDF flyer with QR code
- **Language Link Builder** - Create language-specific booking URLs

### URL Configuration
- **Priority 1**: `EXPO_PUBLIC_BOOKING_BASE_URL` env var (custom domain when DNS confirmed working)
- **Priority 2**: `EXPO_PUBLIC_VIBECODE_BACKEND_URL` (Vibecode backend URL - preview mode)
- **Priority 3**: Hardcoded fallback URL (always works)
- Never defaults to rsvdatabase.com unless explicitly configured via environment variable

### Database Tables (Supabase)
- `public_bookings` - Customer booking records from public booking page
- `appointments` - Business owner's appointments (auto-synced from public_bookings when booking is created)
- `business_hours` - Store operating hours by day of week
- `booking_page_settings` - Language and detection preferences
- `services` - Business service offerings
- `staff` - Staff members with store and service assignments (includes `avatar_url` and `avatar_thumb_url`)
- `staff_services` - Junction table for staff-service skill mapping

### Supabase Storage Buckets
- `staff-photos` - Staff member profile photos (public bucket)
  - Full images: `staff/{business_id}/{staff_id}.jpg` (512px, max 300KB)
  - Thumbnails: `staff/{business_id}/{staff_id}_thumb.jpg` (128px, ~30KB)

### Schema Migration for Staff Avatar Thumbnails
To enable staff photo uploads, run `supabase-staff-avatar-thumbnail.sql` in your Supabase SQL Editor. This migration:
- Adds `avatar_url` column (full-size image URL)
- Adds `avatar_thumb_url` column (thumbnail URL for fast list loading)

Then run `supabase-booking-config-avatar.sql` to update the public booking page to include avatar URLs.

Finally, create the `staff-photos` storage bucket via the Supabase Dashboard:
1. Go to Storage
2. Create bucket named "staff-photos"
3. Set to Public
4. See `supabase-staff-photos-storage.sql` for RLS policy guidance

### Schema Migration for Amount Column
If you see errors like "Could not find the 'amount' column of 'appointments' in the schema cache", run `supabase-fix-appointments-amount.sql` in your Supabase SQL Editor to add missing columns.

### Schema Migration for Services and Staff
If you see errors like "Failed to save service" or "Failed to save staff member", or "Could not find the table 'public.services' in the schema cache", run `supabase-fix-services-staff.sql` in your Supabase SQL Editor. This migration:
- Creates the `services` table with proper RLS policies (INSERT/UPDATE/DELETE for authenticated users)
- Adds the `service_ids` column to `staff` table
- Creates the `staff_services` junction table for staff-service skill mapping
- Sets up proper permissions for both public (booking page) and authenticated (app) access

### Schema Migration for Store-Staff Assignments (REQUIRED)
If staff store assignments are not being saved, run `supabase-store-staff-junction.sql` in your Supabase SQL Editor. This migration:
- Creates the `store_staff` junction table linking staff members to stores
- Sets up proper RLS policies for authenticated and public access
- Creates indexes for fast queries

### Schema Migration for Business Country (REQUIRED for Settings)
If you see errors like:
- "Could not find the 'business_country' column of 'businesses' in the schema cache"
- "Database migration required" when saving Business Information in Settings

Run `supabase-add-business-country.sql` in your Supabase SQL Editor. This migration:
- Adds `business_country` column for currency and regional settings (drives currency, email compliance, footer legal text)
- Adds `business_state` column for US state selection
- Adds `business_address` and `business_phone_number` columns
- Adds `email_footer_language` column for email localization
- Notifies PostgREST to reload schema cache with `NOTIFY pgrst, 'reload schema'`

**Important:** After running the migration, the schema cache refresh is automatic. If you still see errors, wait a few seconds and try again.

### Backend API Routes (Hono)
- `GET /health` - Health check endpoint
- `GET /api/booking/config/:identifier` - Get booking page configuration
- `GET /api/booking/slots` - Get available time slots
- `POST /api/booking/create` - Create new booking
- `GET /api/booking/lookup/:code` - Lookup booking by confirmation code
- `GET /api/booking/confirmation-pdf/:code` - Generate printable HTML confirmation page for PDF download
- `GET /api/booking/share-pdf/:code` - Generate shareable PDF page with native share sheet support
- `GET /calendar/booking/:confirmationCode.ics` - Download ICS file for public booking
- `GET /calendar/:appointmentId.ics` - Download ICS file for business appointment

**Note:** Booking lookup endpoints (`lookup`, `confirmation-pdf`, `share-pdf`) use a fallback strategy:
1. Try the `get_booking_by_confirmation` RPC function first
2. If RPC fails (not deployed), fall back to direct `public_bookings` table query
This ensures the endpoints work even if the Supabase RPC function hasn't been deployed yet.

### SQL Setup
Run `supabase-public-booking.sql` in your Supabase SQL Editor to create all required tables, functions, and policies.

### CRITICAL FIX: Public Bookings Table Schema
**If bookings are failing with errors like:**
- "Could not find the 'booked_locale' column"
- "column public_bookings.service_id does not exist"
- "cannot insert into column 'status' of view 'public_bookings'"

**Run `supabase-fix-public-bookings-complete.sql`** in your Supabase SQL Editor. This comprehensive fix:
- Drops the existing `public_bookings` VIEW (which was incorrectly based on appointments)
- Creates a proper `public_bookings` TABLE with all required columns:
  - `service_id` - Foreign key to services table
  - `customer_name`, `customer_email`, `customer_phone`, `customer_notes` - Customer info
  - `confirmation_code` - Unique code for customer lookup
  - `booked_locale` - Language used during booking
  - `duration_minutes` - Appointment length
  - Full timestamp tracking
- Creates proper RLS policies for public booking flow
- Updates the `create_public_booking` RPC function to work with the new table
- Updates the `get_booking_by_confirmation` function for booking lookup

### CRITICAL FIX: Online Bookings Not Appearing in CRM (Appointments/Calendar)
**If online bookings are created but NOT appearing in:**
- Appointments view
- Today itinerary
- Calendar view
- Client list/details

**Run `supabase-unified-appointments.sql`** in your Supabase SQL Editor. This migration establishes a **single source of truth** architecture:

**Architecture Changes:**
- `appointments` table is now the ONLY source of truth for all bookings
- Added columns to `appointments`:
  - `confirmation_code` - Unique code for online booking lookups
  - `customer_name`, `customer_email`, `customer_phone`, `customer_notes` - Customer info
  - `source` - Tracks origin ('manual', 'online_booking', 'import', 'recurring')
  - `booked_locale` - Language for email translations
- `public_bookings` table is now ONLY for audit/analytics (not queried for logic)

**RPC Functions Updated:**
- `create_public_booking` - Now writes ONLY to `appointments` table
- `get_booking_by_confirmation` - Now queries ONLY `appointments` table

**After running the migration, migrate existing bookings:**
```sql
SELECT public.migrate_bookings_to_unified_appointments();
```

**Verify migration:**
```sql
SELECT id, confirmation_code, customer_name, source
FROM appointments
WHERE source = 'online_booking';
```

This ensures:
- All online bookings immediately appear in CRM
- Share/PDF endpoints work correctly
- No dual data flow or hybrid model

### Fix: Email Confirmation Always Sent After Successful Booking
The backend now **always sends a confirmation email** after a successful `create_public_booking` RPC call:
- Normalizes RPC response data (handles `appointment_id` vs `id` field names)
- Generates confirmation code if RPC doesn't return one
- Email failures are logged but DO NOT block the booking response
- Uses business branding (logo, colors) from Settings > Business Information

### Fix: Canonical UTC Handling for Booking Timestamps + RPC-Only Slot Source
Booking times are now stored correctly using canonical ISO timestamps from Supabase RPC:

**Rules Enforced:**
1. `appointments.start_at` and `end_at` must be stored as `timestamptz` in UTC only
2. Do NOT reconstruct time from display labels like "10:00 AM"
3. When confirming booking, use the exact `slot_start` and `slot_end` timestamps from `get_available_slots`
4. Do NOT apply any extra timezone conversion if timestamps already include offset or Z
5. **ONLY source of available times**: Supabase RPC `get_available_slots` - NO local generation

### REQUIRED MIGRATION: 15-Minute Slot Intervals

**Migration file:** `backend/supabase/migrations/20260318000000_slot_interval_15min.sql`

This migration recreates `get_available_slots` to generate slot start times every **15 minutes** (instead of 30), while strictly enforcing `slot_start + service_duration <= window_end`.

**To apply (run once in Supabase SQL Editor):**
1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/yknyhixurvpwpytfzzsx/sql/new)
2. Paste the contents of `backend/supabase/migrations/20260318000000_slot_interval_15min.sql`
3. Click Run
4. Or fetch the SQL via: `GET /api/migrations/slot-interval-15min` (with `Authorization: Bearer <INTERNAL_SECRET>`)

**Safe to re-run**: uses `CREATE OR REPLACE FUNCTION` — no data loss, no table changes.

**Implementation:**
- **Web booking page** (`bookingPage.ts`):
  - Fetches slots ONLY from `/api/booking/slots` → RPC `get_available_slots`
  - Passes `business_id`, `store_id`, `staff_id`, `service_id`, `date`, `service_duration`
  - Each slot button stores `data-slot-start` and `data-slot-end` ISO timestamps from RPC
  - `selectedSlot` object contains `{ start: ISO, end: ISO }` from API
  - `confirmBooking()` uses `selectedSlot.start` directly - NO reconstruction
  - UI labels format time in **store timezone** for display only
  - Debug logs show: UTC timestamp, local display, store timezone

**Mobile app** (`[slug].tsx`) already correctly:
- Fetches slots from `/api/booking/slots` endpoint
- Stores `selectedSlot` with full ISO timestamps from API
- Uses `selectedSlot.start` directly when confirming

**Store Timezone Column:**
Run `supabase-add-stores-timezone.sql` to add timezone column:
- Adds `timezone TEXT NOT NULL DEFAULT 'UTC'` to stores table
- Updates existing stores to `America/New_York` (US Eastern default)
- Times display in store's timezone, not device timezone
- Common US timezones: `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`

**Email & PDF Timezone Display:**
All appointment confirmation emails and PDFs now display times in store timezone:
- Fetches `store.timezone` from database (fallback: `America/New_York`)
- Uses `timeZone` option in `toLocaleDateString()` and `toLocaleTimeString()`
- Email shows: "Time: 10:00 AM" and "Date: Saturday, February 14, 2026"
- NO UTC rendering - email displays exactly what booking UI showed
- Applied to: confirmation emails, PDF downloads, share PDFs

### Fix: Store Hours Logic in Booking Slots
If booking time slots are showing incorrect hours (defaulting to 9:00 AM - 5:00 PM instead of the store's actual hours), run `supabase-slots-fix-store-hours.sql` in your Supabase SQL Editor. This fix:
- Uses actual store hours from `business_hours` table without 9:00 AM fallback
- Properly prioritizes `store_hours_overrides` (special hours) over regular weekly hours
- Skips days with no hours defined (instead of defaulting to 9-5)
- Priority: store_hours_overrides > blackout_dates > store-specific hours > business-wide hours

### Fix: Closed Location Message for Blackout Dates
**Problem:** When a customer selected a blackout date (store closed), the UI would briefly show "Loading available times..." then switch to "No available times" - confusing and incorrect.

**Solution:** The booking flow now clearly differentiates between:
- **Store is CLOSED** (blackout date, override, or no business hours) → Shows premium closed message
- **Store is OPEN but fully booked** → Shows "No available times"

**Implementation:**
1. **New API endpoint:** `GET /api/booking/check-date-status`
   - Checks if store is closed on a specific date BEFORE fetching slots
   - Returns closure reason: `override`, `blackout`, `weekly_closed`, `no_hours`, or `open`
   - Priority: store_hours_overrides > blackout_dates > business_hours

2. **Frontend flow:**
   - Checks date closure status FIRST (no loading spinner shown yet)
   - If closed → Immediately shows premium closed message (no flicker)
   - If open → Shows loading spinner, then fetches slots

3. **Premium closed message (18 languages):**
   > "This location is closed on the selected date. Please choose another day to continue your booking."
   > "We sincerely apologize for the inconvenience and look forward to assisting you."

**Translation keys added:**
- `locationClosedOnDate` - Main message explaining the closure
- `locationClosedApology` - Elegant apology text

### Effective Hours API (Backend-Driven Today Hours)
The Online Booking landing page now displays "today's hours" using a backend-driven API endpoint instead of frontend calculation. This ensures a **single source of truth** for store hours logic (same rules as `get_available_slots`).

**API Endpoint:** `GET /api/booking/effective-hours`

**Query Parameters:**
- `business_id` (required) - Business UUID
- `store_id` (optional) - Store UUID (if not provided, returns hours for all stores)
- `include_next_slot` (optional) - Set to "true" to include next available slot
- `service_id` (optional) - Required if `include_next_slot` is true

**Response:**
```json
{
  "data": {
    "store_id": "uuid",
    "store_name": "Main Store",
    "date": "2026-02-14",
    "day_of_week": 6,
    "is_closed": false,
    "open_time": "09:00:00",
    "close_time": "17:00:00",
    "formatted_hours": "Today: 9:00 AM - 5:00 PM",
    "source": "weekly",
    "next_available_slot": { "start": "2026-02-14T14:00:00Z", "end": "2026-02-14T15:00:00Z" }
  }
}
```

**Priority Logic (same as `get_available_slots`):**
1. `store_hours_overrides` (special hours/closures) - HIGHEST priority
2. `blackout_dates` (store-level closure dates)
3. `business_hours` (weekly schedule) - store-specific first, then business-wide

**Source Field Values:**
- `"override"` - Using special hours from store_hours_overrides
- `"blackout"` - Closed due to blackout_dates
- `"weekly"` - Using regular weekly business hours
- `"no_hours"` - No hours defined for this day

**Landing Page Display:**
- Shows "(special hours)" indicator when source is "override"
- Shows hours in red when store is closed
- Falls back to frontend logic only if backend hasn't loaded yet

**Backend Logging:**
```
[EffectiveHours] Request received
[EffectiveHours]   business_id: uuid
[EffectiveHours]   store_id: uuid or "all stores"
[EffectiveHours] Today: 2026-02-14 Day of week: 6
[EffectiveHours] Store Main Store: Today: 9:00 AM - 5:00 PM (source: weekly)
```

### Fix: Staff Schedule Fallback for Booking Slots
**If booking shows "No available times" even when store hours allow slots**, run `supabase-slots-with-staff-schedule.sql` in your Supabase SQL Editor. This fix:

**Problem:** When a staff member is selected but has NO `staff_weekly_schedule` rows, the old RPC would skip all days (no fallback to store hours).

**Solution:**
1. If staff has NO schedule at all → treat them as available during store hours (fallback)
2. If staff has schedule for some days but not this day → skip this day (they're scheduled off)
3. Staff special days and blackout ranges take priority over weekly schedule
4. Priority chain:
   - `staff_special_days` (highest for staff)
   - `staff_blackout_ranges`
   - `staff_weekly_schedule`
   - Store hours fallback (if no staff schedule exists)

**Tables created/updated:**
- `staff_weekly_schedule` - Staff regular working hours (day_of_week, start_time, end_time, is_off)
- `staff_special_days` - Date-specific overrides
- `staff_blackout_ranges` - Vacation/leave periods

**Enhanced Logging:** The RPC now logs which constraint eliminates each day:
- `store_override_closed` - Store special hours say closed
- `store_blackout_date` - Store blackout date
- `store_weekly_closed` - Store weekly hours say closed
- `staff_special_day_off` - Staff special day off
- `staff_blackout_range` - Staff in blackout period
- `staff_weekly_off` - Staff weekly schedule says off
- `staff_no_schedule_this_day` - Staff has schedule but not for this day
- `no_hours_defined` - No store hours configured
- `service_duration_too_long` - Service doesn't fit in available window

### Fix: Staff ↔ Services Assignment for Booking
Run `supabase-fix-booking-staff-filtering.sql` in your Supabase SQL Editor to enable proper staff filtering. This fix:
- Gets `store_ids` from `store_staff` junction table (not staff column)
- Gets `service_ids` from `staff_services` junction table (not staff column)
- Includes store hours and store_hours_overrides for availability
- Updates `get_public_booking_config` to include proper staff filtering data
- Staff selection now correctly filters by: store first, then service

### Inline Add Service in Staff Modals
When adding or editing staff members in Settings > Stores & Staff or Settings > Staff Members:
- **Services multi-select** - Select which services each staff member can perform
- **Inline "+ Add Service" button** - Create a new service directly from the staff modal
  - Enter service name, duration, price (optional), and color
  - New service is immediately added to the services list and auto-selected
  - Service also appears in Settings > Services & Products > Services
- Premium UI with dashed border styling and smooth animations

### Roles & Permissions (RBAC) - Shadow Mode

Enterprise-grade Role-Based Access Control for team management. Currently in **Shadow Mode** - UI displays and logs permission checks, but does not block actions in the backend yet.

#### Roles
- **Owner** - Full access to all features, non-removable system powers (billing, ownership transfer)
  - Cannot be downgraded or removed by anyone
  - All permissions permanently enabled
- **Manager** - Configurable permissions by owner
  - Default: Most permissions enabled except store/staff deletion and billing
- **Staff** - Limited access for team members
  - Default: Basic client and appointment permissions only

#### Philosophy
- **All roles can VIEW everything** - No data is hidden based on role
- **Only ACTIONS are restricted** - Create, edit, delete, send, activate buttons can be disabled
- Owners configure which actions Managers and Staff can perform

#### Permission Categories (10)
1. **Clients** - Create, edit, delete, archive, export, send email
2. **Appointments** - Create, edit, delete, cancel
3. **Staff Management** - Add, edit, remove, assign to stores, manage schedules
4. **Stores** - Create, edit, delete, manage hours
5. **Services** - Create, edit, delete
6. **Campaigns** - Create, edit, delete, activate, send
7. **Promotions** - Create, edit, delete, activate
8. **Analytics** - View revenue, export data
9. **Settings** - Business info, theme, booking page, roles & permissions (owner-only)
10. **Billing** - View, manage, cancel subscription (owner-only, non-configurable)

#### UI Location
Settings > **Roles & Permissions**
- Owner card (always shown, non-editable)
- Role tabs: Manager | Staff
- Permission toggles organized by category
- Reset to Defaults button
- Save button (appears when changes are made)

#### Shadow Mode Features
- Blue info banner indicates Preview Mode
- Permission checks are logged to console with `[RBAC]` prefix
- `[RBAC SHADOW]` logs show what WOULD be blocked in production
- Audit summary available via `getAuditSummary()` in permissionService

#### Implementation Files
- `/src/lib/rbac/permissions.ts` - Permission constants, metadata, defaults
- `/src/lib/rbac/types.ts` - TypeScript interfaces for RBAC
- `/src/lib/rbac/permissionService.ts` - `can()` helper, caching, audit logging
- `/src/lib/rbac/usePermissions.ts` - React hooks (`useRBAC`, `usePermission`, `useRole`)
- `/src/lib/rbac/index.ts` - Barrel exports
- `/src/components/RolesPermissionsScreen.tsx` - Settings UI component

#### Database Tables (Supabase)
Run `supabase-rbac-shadow-mode.sql` to create:
- `business_members` - Links users to businesses with roles
- `role_permissions` - Custom permission configs per business/role
- `permission_audit_logs` - Shadow mode telemetry
- `business_invites` - Team member invitations

#### Usage in Components
```typescript
import { useRBAC, PERMISSIONS } from '@/lib/rbac';

function MyComponent() {
  const { can, isOwner, role } = useRBAC();

  // Check single permission
  if (can(PERMISSIONS.CLIENTS_DELETE)) {
    // Show delete button
  }

  // Check multiple permissions
  if (canAny([PERMISSIONS.CAMPAIGNS_CREATE, PERMISSIONS.CAMPAIGNS_EDIT])) {
    // Show campaigns section
  }
}
```

#### Translation Support
All RBAC UI text is translated in 18 languages:
- Role names and descriptions
- Permission category names
- Individual permission labels and descriptions
- UI labels (save, reset, shadow mode notice)

### Staff Access (Team Invitations)

Enterprise feature allowing business owners to invite team members to access the app.

#### Features
- **Invite by Email** - Owners can invite new team members by email address
- **Role Assignment** - Assign Manager or Staff role at invite time
- **Store Assignment** - Optionally assign specific stores (or "All Stores")
- **Auto-Activation** - When invitee signs up or logs in with matching email, membership is automatically created
- **Subscription Bypass** - Staff/Managers can access the app without their own paid subscription (billing remains owner-only)
- **Team Management** - View pending invites, resend/cancel invites, remove team members
- **Owner Protection** - Business owner is always displayed as "Owner" role and cannot be removed from the team
- **Smart Identity Display** - Team members shown with name/email instead of UUID (falls back gracefully)

#### UI Location
Settings > **Staff Access**
- Invite form with email, role selector, store assignment
- Pending invites list with resend/cancel actions
- Team members list showing role (Owner/Manager/Staff), name/email, and remove action (non-owners only)

#### Implementation Files
- `/src/services/staffInviteService.ts` - Invite CRUD, membership management, auto-activation
- `/src/hooks/useStaffInvites.ts` - React Query hooks for invites and members
- `/src/components/StaffAccessScreen.tsx` - Settings UI component
- `/src/hooks/useSupabaseAuth.ts` - Auto-processes invites on sign-in/sign-up
- `/src/lib/trial-service.ts` - Updated to allow staff access without subscription

#### Database Tables
- `business_invites` - Pending invitations with invite codes and expiry
- `business_members` - Active memberships linking users to businesses with roles

#### Translation Support
All Staff Access UI text is translated in 18 languages.

#### Performance Optimizations
- **Single RPC call** - Both pending invites and team members fetched via one `get_staff_access_data` RPC
- **React Query caching** - 60s staleTime (no refetch if fresh), 5min gcTime
- **No refetch on mount/focus** - Uses cached data when available
- **Instant render** - Shows cached data immediately, skeleton only on initial load with no cache
- **DEV logging** - Logs RPC call count and duration (look for `[StaffAccess PERF]` in console)

#### RPC Setup
To enable member name/email display, deploy the updated RPC function:
```sql
-- Run supabase-staff-access-rpc.sql in Supabase SQL Editor
-- This adds user_email and user_name fields from profiles table
```

#### Next Steps (Future)
1. Add RLS policies to enforce permissions server-side
2. Add store-scoped permissions (staff can only access certain stores)
3. Enable "real mode" by setting `SHADOW_MODE = false` in permissionService

### Tamper-Evident Audit Log (Hash Chain)

Cryptographically linked audit log where each entry's hash depends on the previous entry, making tampering detectable.

#### Features
- **SHA-256 Hash Chain** - Each row's `chain_hash` is computed as `SHA256(prev_hash || canonical_text)`
- **Per-Business Chains** - Each business has its own independent chain
- **Deterministic Ordering** - Rows processed in `(created_at ASC, id ASC)` order
- **Auto-Hash Trigger** - New inserts automatically compute their chain_hash
- **Verification Function** - `app_verify_audit_chain(business_id)` checks chain integrity
- **Backfill Support** - `app_backfill_audit_chain(business_id)` or `app_backfill_all_audit_chains()` for existing data

#### Database Schema
```sql
audit_log (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  business_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  chain_hash BYTEA NOT NULL  -- SHA-256 hash chain
)
```

#### SQL Functions
- `app_audit_log_canonical(...)` - Builds deterministic text representation
- `app_compute_chain_hash(prev_hash, canonical)` - Computes SHA-256 chain hash
- `app_backfill_audit_chain(business_id)` - Backfills one business
- `app_backfill_all_audit_chains()` - Backfills all businesses
- `app_verify_audit_chain(business_id)` - Verifies chain integrity

#### Migration Files
- `supabase-audit-log-hash-chain.sql` - Full migration (run all at once)
- `supabase-audit-log-hash-chain-steps.sql` - Step-by-step version

#### Verification Queries
```sql
-- Show latest entries with hash
SELECT id, created_at, action, encode(chain_hash, 'hex') AS hash_hex
FROM audit_log ORDER BY created_at DESC LIMIT 10;

-- Verify chain (returns only invalid rows)
SELECT * FROM app_verify_audit_chain('BUSINESS_UUID') WHERE is_valid = false;

-- Full verification report
SELECT * FROM app_verify_audit_chain('BUSINESS_UUID');
```

