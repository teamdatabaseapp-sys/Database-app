# Security Audit Report
**Date:** 2026-03-13
**Scope:** Full production security audit — mobile app + backend API
**Method:** Static code analysis (no dynamic testing performed)

---

## Executive Summary

The codebase has a **solid security foundation**: Supabase JWT auth is consistently applied to business data routes, input validation via Zod is present on critical endpoints, rate limiting is multi-layered, and no backend secrets are exposed in frontend source code.

**Five issues require attention before production deployment.** One is critical.

---

## Findings

### CRITICAL

---

#### C-1: Unauthenticated Migration POST Endpoints

**File:** `backend/src/routes/migrations.ts`
**Severity:** CRITICAL
**Lines:** 519, 609, 851, 990, 1066, 1519, 1715, 1921, 2015, 2100+ (all POST routes)

Every POST endpoint on the migrations router has zero authentication. Any unauthenticated HTTP client can call them directly.

The routes perform real operations: fixing RLS policies, modifying gift card structures, patching counter RPCs, modifying appointment data. Several of them use the Supabase service role key (loaded from env) to execute privileged SQL via the Management API.

**Example exposed endpoints:**
- `POST /api/migrations/fix-counter-rpc` — executes SQL on the database
- `POST /api/migrations/fix-booking-service-id` — modifies appointment data
- `POST /api/migrations/fix-gift-cards-rls` — alters RLS policies
- `GET /api/migrations/status` — exposes full migration status and schema info
- `GET /api/migrations/sql` — returns raw migration SQL

**Recommended fix:**
Gate every route in `migrations.ts` behind an `INTERNAL_SECRET` check (same pattern used by `/api/metrics`). These routes should only be callable by the app owner during deployment, never by clients.

```typescript
// Add to every migrations route:
const secret = c.req.header('x-internal-secret');
if (!secret || secret !== process.env.INTERNAL_SECRET) {
  return c.json({ error: 'Unauthorized' }, 401);
}
```

---

### HIGH

---

#### H-1: Supabase Error Details Leaked in HTTP Responses

**Files and lines:**
- `backend/src/routes/giftCards.ts:129` — `bizError.details`, `bizError.hint`
- `backend/src/routes/giftCards.ts:321` — `ie.details`, `ie.hint`
- `backend/src/routes/booking.ts:2924` — `error.message` in `details` field
- `backend/src/routes/booking.ts:2997` — `error.message` in `details` field

Several error responses return raw Supabase error objects to the client, including `.details`, `.hint`, `.code` fields. These can reveal column names, constraint names, table structure, and internal query information.

Example (giftCards.ts:129):
```typescript
return c.json({
  error: bizError.message,
  code: bizError.code,
  details: bizError.details,   // exposes schema details
  hint: bizError.hint,          // exposes DB hints
  step: 'business_lookup'
}, 500);
```

**Recommended fix:**
Strip internal fields from all error responses. Return only a generic message and a stable error code string you define:

```typescript
// Replace with:
return c.json({ error: 'Business lookup failed' }, 500);
```

---

#### H-2: .env Files Committed to Git

**Files:**
- `backend/.env`
- `backend/.env.production`
- `mobile/.env`
- `mobile/.env.production`

All `.env` files are tracked in git and contain live credentials. Anyone with repository access can read them.

**Keys exposed in git history:**
- `RESEND_API_KEY` — live email sending key
- `SUPABASE_SERVICE_ROLE_KEY` — admin-level database access, bypasses all RLS
- `OPENAI_API_KEY` — billed API key

**Recommended fix (in order):**

1. Rotate all exposed keys immediately:
   - Supabase: Dashboard → Settings → API → rotate service role key
   - Resend: Dashboard → API Keys → delete and regenerate
   - OpenAI: Platform → API Keys → revoke and regenerate

2. Remove from git history:
   ```bash
   # Using BFG (faster than git filter-branch):
   bfg --delete-files .env
   bfg --delete-files .env.production
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```

3. Add to `.gitignore`:
   ```
   .env
   .env.production
   .env.local
   .env.*.local
   ```

4. Use `.env.example` files with placeholder values for documentation.

**Note:** The Vibecode platform injects `.env` contents as environment variables at runtime, so the app will continue to work after rotating keys and removing the files from git.

---

### MEDIUM

---

#### M-1: Missing HTTP Security Headers

**File:** `backend/src/index.ts`
**Finding:** No helmet or equivalent security header middleware is present. Searched for `helmet`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy` — zero results.

**Missing headers:**
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS
- `X-XSS-Protection: 0` — disables legacy XSS filter (recommended per OWASP)

**Recommended fix:**
Add `@hono/hono`'s built-in security headers middleware (no new dependency needed):

```typescript
import { secureHeaders } from 'hono/secure-headers';
app.use('*', secureHeaders());
```

---

#### M-2: Unsigned Unsubscribe Tokens

**File:** `backend/src/routes/bulkEmail.ts` (unsubscribe token generation)

Unsubscribe tokens are plain base64-encoded JSON: `btoa(JSON.stringify({email, businessId, timestamp}))`. They have no cryptographic signature. An attacker who knows any user's email and a business ID can forge a valid unsubscribe token and unsubscribe arbitrary recipients.

**Recommended fix:**
Sign tokens with HMAC-SHA256 using a server secret:

```typescript
import { createHmac } from 'crypto';

function signToken(payload: object): string {
  const data = JSON.stringify(payload);
  const sig = createHmac('sha256', process.env.INTERNAL_SECRET!)
    .update(data)
    .digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

function verifyToken(token: string): object | null {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, 'base64url').toString());
    const expected = createHmac('sha256', process.env.INTERNAL_SECRET!)
      .update(data)
      .digest('hex');
    if (sig !== expected) return null;
    return JSON.parse(data);
  } catch { return null; }
}
```

---

#### M-3: Fair-Use Rate Limiting in Shadow Mode Only

**File:** `backend/src/lib/usageTracker.ts`
**Relevant routes:** bulk email, drip campaigns, transactional email

Fair-use limits are currently set to shadow mode — they log warnings but never block requests. In production this means no hard cap on email volume per business, which creates financial exposure.

**Recommended fix:**
Before production launch, evaluate actual usage patterns from shadow mode logs and then disable shadow mode:

```typescript
const FAIR_USE_SHADOW_MODE = process.env.NODE_ENV === 'production' ? false : true;
```

---

### LOW

---

#### L-1: Stack Traces Logged in Global Error Handler

**File:** `backend/src/index.ts:47`

```typescript
console.error("[GlobalError] Unhandled error:", err.message, err.stack);
```

Stack traces are not exposed in HTTP responses (which correctly return `"Internal server error"`), but they are written to logs. In environments where logs are accessible to non-admin parties, stack traces reveal internal file paths, library versions, and code structure.

**Recommended fix:**
In production, log only `err.message`:

```typescript
if (process.env.NODE_ENV === 'production') {
  console.error("[GlobalError]", err.message);
} else {
  console.error("[GlobalError] Unhandled error:", err.message, err.stack);
}
```

---

#### L-2: Confirmation Codes Use 8-Character UUID Prefix

**File:** `backend/src/routes/booking.ts` (confirmation code generation)

Public booking lookups use 8-character uppercase UUID prefixes as confirmation codes (e.g., `1A2B3C4D`). UUID v4 prefixes have limited entropy and could theoretically be enumerated — though the existing 10 req/min rate limit on the lookup endpoint significantly reduces the practical risk.

**Recommended fix (low priority):**
Generate confirmation codes from `crypto.randomBytes`:

```typescript
import { randomBytes } from 'crypto';
const code = randomBytes(6).toString('hex').toUpperCase(); // 12 hex chars
```

---

## Verification: What Is Working Correctly

| Area | Status | Notes |
|---|---|---|
| Authentication on business data routes | PASS | Bearer token + Supabase JWT consistently applied |
| Business isolation | PASS | `verifyBusinessOwnership()` on all protected write routes; business_id never trusted from request body |
| Input validation | PASS | Zod schemas on all critical endpoints (appointments, bookings, bulk email) |
| Backend secrets in frontend code | PASS | No `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or `STRIPE_SECRET` in `mobile/src/` |
| Supabase service role key in responses | PASS | Key never returned in any HTTP response body |
| Rate limiting | PASS | Global (60/min), per-endpoint, and distributed rate limiting present |
| CORS | PASS | Explicit allowlist, no `*` wildcard |
| SQL injection | PASS | Supabase client uses parameterized queries throughout |
| File upload security | PASS | MIME allowlist, size cap, EXIF stripping, Sharp revalidation |
| Financial operation idempotency | PASS | Gift card debits and loyalty points have idempotency guards |
| Audit logging | PASS | Sensitive financial operations log audit events |
| Error responses (HTTP) | PASS | Global handler returns generic `"Internal server error"` |
| Blocked path patterns | PASS | `.env`, `.git`, `wp-admin`, `phpmyadmin`, etc. blocked |
| Health endpoint | PASS | Returns only uptime metrics, no secrets |
| Kill switches | PASS | Bulk email, drip, transactional, AI all have feature-level kill switches |
| Transactional email auth | PASS | POST `/api/transactional/notify` requires `resolveTenantContext()` |
| Gift card write auth | PASS | POST `/api/gift-cards/issue` requires `requireAuth()` + ownership check |

---

## Priority Order for Fixes

| Priority | Issue | Effort |
|---|---|---|
| 1 (do first) | C-1: Gate migration endpoints | Low — add one `INTERNAL_SECRET` check per route or at router level |
| 2 (do first) | H-2: Rotate exposed keys + remove from git | Medium — requires key rotation in all services |
| 3 | H-1: Strip error details from responses | Low — replace 4 error responses |
| 4 | M-1: Add security headers | Very low — one line (`secureHeaders()` middleware) |
| 5 | M-2: Sign unsubscribe tokens | Medium — requires token format change |
| 6 | M-3: Enable fair-use blocking | Low — flip one boolean after validation |
| 7 | L-1: Conditional stack trace logging | Very low — wrap in env check |
| 8 | L-2: Stronger confirmation codes | Low — swap UUID slice for randomBytes |

---

*Audit performed via static analysis. Dynamic testing (penetration testing, fuzzing, auth bypass testing) is recommended on a staging environment before launch.*
