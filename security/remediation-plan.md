# Security Remediation Plan
**Generated:** 2026-03-13
**Source:** security-audit.md
**Method:** All findings verified against live source code before writing this plan.

---

## 1. Executive Summary

8 findings across 2 critical, 2 high, 3 medium, 1 low severity. The security foundation is solid — JWT auth, Zod validation, rate limiting, and CORS are all correctly implemented. The gaps are specific and fixable.

**Fastest total fix time:** The 5 highest-severity issues can all be resolved with small, surgical edits. The two most dangerous (C-1 and H-2) require less than 30 lines of code and one external action (key rotation) respectively.

---

## 2. Launch Blockers

These must be resolved before exposing the app to real users or public traffic.

| # | ID | Reason it blocks launch |
|---|---|---|
| 1 | **C-1** | 14 unauthenticated POST routes can execute privileged DB operations on your live Supabase instance. Any internet scan will find them. |
| 2 | **H-2** | Live `SUPABASE_SERVICE_ROLE_KEY` is in git history. Anyone with repo access can run admin queries against your database right now. |
| 3 | **H-1** | Raw Supabase error internals returned in HTTP responses, leaking your schema to any caller who triggers an error. |

Everything below H-1 is a hardening measure, not a blocker.

---

## 3. File-by-File Remediation Plan

---

### FIX 1 — C-1: Gate All Migration Routes (CRITICAL, Launch Blocker)

**File:** `backend/src/routes/migrations.ts`
**Risk:** 30 routes (14 POST + 16 GET) are fully public with zero authentication. The POST routes can execute SQL, alter RLS policies, and modify live data via the Supabase service role key. Any attacker who finds the URL can destroy or corrupt your database.

**Exact routes exposed (14 POST + 16 GET = 30 total):**

| Line | Method | Path |
|------|--------|------|
| 19 | GET | `/status` |
| 104 | GET | `/sql` |
| 423 | GET | `/fix-promotions-sql` |
| 519 | POST | `/fix-counter-rpc` |
| 609 | POST | `/fix-booking-service-id` |
| 818 | GET | `/fix-booking-service-id` |
| 851 | POST | `/fix-gift-cards-rls` |
| 937 | GET | `/fix-gift-cards-rls` |
| 990 | POST | `/add-gift-card-created-by` |
| 1032 | GET | `/add-gift-card-created-by` |
| 1047 | GET | `/appointment-lifecycle-sql` |
| 1066 | POST | `/appointment-lifecycle` |
| 1519 | POST | `/add-business-timezone` |
| 1609 | GET | `/fix-online-booking-rpc` |
| 1715 | POST | `/fix-online-booking-rpc` |
| 1913 | GET | `/fix-client-dedup` |
| 1921 | POST | `/fix-client-dedup` |
| 1959 | GET | `/fix-booking-page-settings` |
| 2015 | POST | `/fix-booking-page-settings` |
| 2100 | GET | `/fix-client-email-uniqueness` |
| 2116 | POST | `/fix-client-email-uniqueness` |
| 2181 | POST | `/add-is-log-visit` |
| 2257 | GET | `/add-is-log-visit` |
| 2301 | GET | `/drip-campaign-sends` |
| 2354 | POST | `/add-drip-trigger-columns` |
| 2397 | GET | `/add-drip-trigger-columns` |
| 2437 | GET | `/drip-sends-retry-lock` |
| 2461 | POST | `/drip-sends-retry-lock` |
| 2570 | POST | `/perf-phase2a-indexes` |
| 2627 | GET | `/perf-phase2a-indexes` |

**Remediation approach:**

Use the exact same pattern already used by `/api/metrics` in `index.ts:496–516`: read `INTERNAL_SECRET` from env, reject with 503 if unset, require `Authorization: Bearer <secret>` header, reject with 401/403 on mismatch.

Apply it at the **router level** using Hono middleware — one block at the top of `migrations.ts` protects all 30 routes without touching each route individually:

```typescript
// Add at the top of migrations.ts, after `const migrationsRouter = new Hono();`

migrationsRouter.use('*', async (c, next) => {
  const secret = process.env.INTERNAL_SECRET ?? '';
  if (!secret) {
    return c.json({ error: 'Service unavailable' }, 503);
  }
  const authHeader = c.req.header('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (authHeader.slice(7) !== secret) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});
```

**Pre-requisite:** Add `INTERNAL_SECRET` to `backend/.env` and `backend/.env.production`:
```
INTERNAL_SECRET=<generate with: openssl rand -hex 32>
```

`INTERNAL_SECRET` is currently absent from both env files. It must be added before this middleware will admit any requests.

**Should migration routes be disabled in production?**
No — they need to be callable during deployment to apply schema fixes. The secret gate is the right approach. Do not remove the routes. After all pending migrations are applied and confirmed, you can optionally return `410 Gone` from POST routes, but that is not required now.

---

### FIX 2 — H-2: Rotate Exposed Keys and Remove .env from Git (HIGH, Launch Blocker)

**Files tracked in git:**
- `backend/.env`
- `backend/.env.production`
- `mobile/.env`
- `mobile/.env.production`

**Keys that must be rotated (in order of blast radius):**

| Key | File | Risk |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env`, `backend/.env.production` | Admin access to entire DB, bypasses all RLS — highest priority |
| `RESEND_API_KEY` | `backend/.env`, `backend/.env.production` | Can send email as your domain |
| `OPENAI_API_KEY` | `backend/.env`, `backend/.env.production`, `mobile/.env.production` | Billed API access |

**Step-by-step:**

**Step 1 — Rotate keys (do this first, before git cleanup):**
1. Supabase service role key: `supabase.com/dashboard` → your project → Settings → API → rotate the `service_role` key → copy new value
2. Resend API key: `resend.com/api-keys` → delete exposed key → create new key → copy new value
3. OpenAI API key: `platform.openai.com/api-keys` → revoke exposed key → create new key → copy new value

**Step 2 — Update env files with new values** (while still tracked, before untracking)

**Step 3 — Untrack .env files from git:**
```bash
git rm --cached backend/.env backend/.env.production mobile/.env mobile/.env.production
```

**Step 4 — Add to .gitignore** (root-level `.gitignore`):
```
.env
.env.production
.env.local
.env.*.local
backend/.env
backend/.env.production
mobile/.env
mobile/.env.production
```

**Step 5 — Commit:**
```bash
git add .gitignore
git commit -m "security: untrack env files and update .gitignore"
```

**Step 6 — Purge from git history** (removes old values from all past commits):
```bash
# Using BFG Repo-Cleaner (faster than filter-branch):
bfg --delete-files .env
bfg --delete-files .env.production
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**Note:** The Vibecode platform injects env file contents as runtime environment variables. The app will continue to work normally after the files are untracked from git. Only the git history copy is removed.

**Step 7 — Create example files** for documentation:
- `backend/.env.example` with placeholder values (no real keys)
- `mobile/.env.example` with placeholder values

---

### FIX 3 — H-1: Strip Internal Error Details from HTTP Responses (HIGH, Launch Blocker)

**4 exact locations to fix:**

**Location 1 — `backend/src/routes/giftCards.ts:129`**

Current:
```typescript
return c.json({ error: bizError.message, code: bizError.code, details: bizError.details, step: 'business_lookup' }, 500);
```
Replace with:
```typescript
console.error('[GiftCards] Business lookup error:', bizError.message, '| code:', bizError.code, '| details:', bizError.details);
return c.json({ error: 'Internal server error' }, 500);
```
(The `console.error` is already on line 128 — just remove the fields from the JSON response.)

**Location 2 — `backend/src/routes/giftCards.ts:321`**

Current:
```typescript
return c.json({ error: ie.message, code: ie.code, details: ie.details, hint: ie.hint, step: 'insert' }, 500);
```
Replace with:
```typescript
return c.json({ error: 'Internal server error' }, 500);
```
(The `console.error` is already on line 320.)

**Location 3 — `backend/src/routes/booking.ts:2924`**

Current:
```typescript
return c.json({ error: "Failed to fetch booking settings", details: error.message }, 500);
```
Replace with:
```typescript
return c.json({ error: "Failed to fetch booking settings" }, 500);
```
(The `console.error` is already on line 2923.)

**Location 4 — `backend/src/routes/booking.ts:2997`**

Current:
```typescript
return c.json({ error: "Failed to save booking settings", details: error.message }, 500);
```
Replace with:
```typescript
return c.json({ error: "Failed to save booking settings" }, 500);
```
(The `console.error` is already on line 2996.)

**Pattern rule going forward:** The logging is already correct in all 4 cases — the `console.error` before each return captures the full detail for internal debugging. The fix is purely removing those details from the JSON response.

---

### FIX 4 — M-1: Add HTTP Security Headers (MEDIUM, Not a Launch Blocker)

**File:** `backend/src/index.ts`
**Risk:** No `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers. Allows clickjacking and MIME-sniffing attacks.

`secureHeaders` is built into Hono — no new dependency.

**Exact change:** Add one import and one `app.use()` call near the top of `index.ts`, after the error handler and before the rate limiting middleware:

```typescript
// Add to imports (near top of file):
import { secureHeaders } from 'hono/secure-headers';

// Add after app.onError(...) block, before the rate limiting middleware:
app.use('*', secureHeaders());
```

Default headers applied by `secureHeaders()`:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`
- `X-XSS-Protection: 0` (disables legacy filter per OWASP)
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy: no-referrer`

All of these are safe defaults for this API. No customization needed.

---

### FIX 5 — M-2: Sign Unsubscribe Tokens with HMAC (MEDIUM, Not a Launch Blocker)

**Files involved:**
- Token generation: `backend/src/routes/bulkEmail.ts:382–390`
- Token verification: `backend/src/index.ts:562–581`

**Current vulnerable code — generation (`bulkEmail.ts:382–390`):**
```typescript
function generateUnsubscribeToken(email: string, businessId: string): string {
  const payload = JSON.stringify({ email, businessId, timestamp: Date.now() });
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
```

**Current vulnerable code — verification (`index.ts:562–581`):**
Decodes with `atob`/`Buffer.from`, parses JSON, checks 30-day expiry. No signature check.

**Replacement design:**

Both files must change together. The token format changes from `btoa(JSON)` to `base64url(JSON + HMAC)`.

**New `generateUnsubscribeToken` (replaces `bulkEmail.ts:382–390`):**
```typescript
import { createHmac } from 'crypto';

function generateUnsubscribeToken(email: string, businessId: string): string {
  const data = JSON.stringify({ email, businessId, timestamp: Date.now() });
  const sig = createHmac('sha256', process.env.INTERNAL_SECRET ?? 'fallback')
    .update(data)
    .digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}
```

**New verification block (replaces `index.ts:562–581`):**
```typescript
try {
  const raw = Buffer.from(token, 'base64url').toString('utf8');
  const { data, sig } = JSON.parse(raw) as { data: string; sig: string };
  const expected = createHmac('sha256', process.env.INTERNAL_SECRET ?? 'fallback')
    .update(data)
    .digest('hex');
  if (sig !== expected) {
    return unsubPage("⚠️", "Invalid Link", "This unsubscribe link is invalid.", 400);
  }
  const payload = JSON.parse(data) as { email: string; businessId: string; timestamp: number };
  email = payload.email || '';
  businessId = payload.businessId || '';
  if (Date.now() - payload.timestamp > 30 * 24 * 60 * 60 * 1000) {
    return unsubPage("⏰", "Link Expired", "This link has expired.", 400);
  }
} catch {
  return unsubPage("⚠️", "Invalid Link", "This unsubscribe link is invalid.", 400);
}
```

**Dependency:** Requires `INTERNAL_SECRET` in env (same secret added for FIX 1). The `createHmac` import is from Node built-ins — no new packages.

**Migration concern:** Old tokens (already sent in emails) will fail verification after this change. Since unsubscribe tokens expire in 30 days anyway, the exposure window is limited. If needed, keep the legacy `atob` decoder as a fallback for a 30-day window, then remove it.

---

### FIX 6 — M-3: Enable Fair-Use Hard Blocking (MEDIUM, Not a Launch Blocker)

**Files involved:**
- `backend/src/index.ts:380–383, 409–411, 439–441` — 3 shadow-mode pass-through blocks
- `backend/src/lib/dripScheduler.ts:659–663` — drip shadow-mode pass-through

**Current state:** The blocking code is already written and commented out. Shadow mode means the limits are never enforced — a single business can send unlimited emails.

**Exact change — `index.ts:380–383`:**
```typescript
// Remove comment, activate the block:
if (!FAIR_USE_SHADOW_MODE) {
  return c.json({ error: "Service temporarily unavailable. Fair-use limit reached." }, 429);
}
```
Do the same for the two similar blocks at lines 409–411 and 439–441.

**Exact change — `index.ts` import:** Export `FAIR_USE_SHADOW_MODE` as `false` from `usageTracker.ts` OR add an env-controlled override:

```typescript
// In usageTracker.ts — change or make env-controlled:
export const FAIR_USE_SHADOW_MODE = process.env.FAIR_USE_SHADOW_MODE !== 'false';
// Default: true (shadow mode) unless env var is explicitly set to 'false'
```

Then in production `backend/.env.production`:
```
FAIR_USE_SHADOW_MODE=false
```

This approach keeps shadow mode in development by default but activates hard blocking in production.

**Do this last** — after reviewing shadow mode logs to confirm the thresholds are reasonable for your actual user traffic. The existing thresholds are generous: 500 recipients/call, 5 bulk sends/hour, 200 transactional/hour.

---

### FIX 7 — L-1: Conditional Stack Trace Logging (LOW)

**File:** `backend/src/index.ts:47`

Current:
```typescript
console.error("[GlobalError] Unhandled error:", err.message, err.stack);
```

Replace with:
```typescript
if (process.env.NODE_ENV === 'production') {
  console.error("[GlobalError]", err.message);
} else {
  console.error("[GlobalError] Unhandled error:", err.message, err.stack);
}
```

---

### FIX 8 — L-2: Stronger Confirmation Code Generation (LOW)

**File:** `backend/src/routes/booking.ts` — confirmation code generation
**Current:** `appointmentId.slice(0, 8).toUpperCase()` — 8-char UUID prefix

**Replace with:**
```typescript
import { randomBytes } from 'crypto';
// In the booking creation code, replace the UUID prefix:
const confirmationCode = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars, 40 bits of entropy
```

Note: The existing 10 req/min rate limit on `/api/booking/lookup/*` already makes enumeration impractical. This is a minor hardening measure, not urgent.

---

## 4. Recommended Fix Order

| Order | Fix | File(s) | Complexity | Blocks Launch? |
|---|---|---|---|---|
| 1 | Add `INTERNAL_SECRET` to both `.env` files | `backend/.env`, `backend/.env.production` | Trivial | Yes — needed for FIX 2 |
| 2 | **C-1**: Gate migration router with middleware | `backend/src/routes/migrations.ts` | Low (8 lines at top of file) | Yes |
| 3 | **H-2**: Rotate Supabase service role key | External (Supabase dashboard) | External action | Yes |
| 4 | **H-2**: Rotate Resend + OpenAI keys | External (Resend, OpenAI dashboards) | External action | Yes |
| 5 | **H-2**: Untrack `.env` from git + add to `.gitignore` | `.gitignore` | Low | Yes |
| 6 | **H-1**: Strip 4 error detail leaks | `giftCards.ts:129,321`, `booking.ts:2924,2997` | Low (4 one-line changes) | Yes |
| 7 | **M-1**: Add `secureHeaders()` middleware | `backend/src/index.ts` | Trivial (2 lines) | No |
| 8 | **M-2**: Sign unsubscribe tokens | `bulkEmail.ts:382–390`, `index.ts:562–581` | Medium | No |
| 9 | **M-3**: Activate fair-use blocking | `usageTracker.ts`, `index.ts:380,409,439` | Low | No |
| 10 | **L-1**: Conditional stack trace logging | `backend/src/index.ts:47` | Trivial (3 lines) | No |
| 11 | **L-2**: Stronger confirmation codes | `backend/src/routes/booking.ts` | Low | No |

---

## 5. Risk Reduction After Fixes

| After completing... | Risk level |
|---|---|
| FIX 1 (INTERNAL_SECRET in env) | No change yet |
| FIX 2 (gate migrations) | Removes the only vector for unauthenticated DB writes. **Critical risk eliminated.** |
| FIX 3+4+5 (key rotation + git cleanup) | Eliminates service role key exposure. Existing compromise window closed. **High risk eliminated.** |
| FIX 6 (strip error details) | Removes schema leakage from error responses. **Second high risk eliminated.** |
| FIX 7 (security headers) | Prevents clickjacking, MIME sniffing, downgrade attacks. |
| FIX 8 (signed unsubscribe tokens) | Prevents unsubscribe forgery at scale. |
| FIX 9 (fair-use enforcement) | Prevents email cost abuse by any single business. |
| FIX 10+11 (logging + codes) | Minor hardening, no material risk change. |
| **All fixes applied** | **Production-ready security posture.** Remaining attack surface is standard for a Supabase/Hono SaaS app with proper auth. |

---

*This plan is based on verified source code review. All file paths, line numbers, and code snippets are confirmed against the live codebase as of 2026-03-13.*
