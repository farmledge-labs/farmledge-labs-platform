# Security Checklist for FarmLedge API

> **Living document** — run through this checklist before every new endpoint lands on `main`.
> Keep the checklist honest: fix gaps here rather than leaving them for later.

---

## How to use

Copy the checklist below into your PR description (or reference this file).
Mark each item `[x]` when done, `[~]` when intentionally skipped with a reason, or `[ ]` when not yet addressed.

---

## Pre-merge checklist

### 1  CORS

- [ ] The new endpoint is mounted under `/api/v1` and therefore inherits the global CORS policy in `src/app.ts`.
- [ ] No endpoint-level CORS override has been added that widens the global policy.
- [ ] If the endpoint must be public (no `Origin` restriction), that decision is documented in the PR.
- [ ] Production deployments set `ALLOWED_ORIGINS` to the exact set of allowed front-end origins; wildcards (`*`) are never used in production.

**How CORS is configured:**  
`app.ts` passes `cors(corsOptions)` globally before any routes.  
- `NODE_ENV !== 'production'` → all origins allowed (development convenience).  
- `NODE_ENV === 'production'` → only origins listed in `ALLOWED_ORIGINS` (comma-separated env var) are permitted.

---

### 2  Rate limiting

- [ ] The endpoint is protected by the existing express-rate-limit middleware (or a route-specific limiter for sensitive endpoints).
- [ ] Auth endpoints (`/auth/login`, `/auth/register`) use a stricter limiter (e.g., 10 req / 15 min per IP).
- [ ] Admin endpoints have their own limiter (separate from the public API pool).

---

### 3  Authentication & authorisation

- [ ] Every endpoint that touches user data is guarded by `requireJWT` **or** `requireAPIKey`.
- [ ] The handler scopes DB queries to the authenticated identity (`req.user.sub`), never to a path parameter alone.
- [ ] Admin-only endpoints check `X-Admin-Secret` against `PLATFORM_ADMIN_SECRET` **before** doing any work.
- [ ] Lender endpoints use `requireAPIKey` (hashed, salted, stored in DB).

---

### 4  Input validation (Zod)

- [ ] Every POST / PATCH / PUT endpoint applies `validate(SomeSchema)` from `src/middleware/validate.middleware.ts`.
- [ ] The schema covers **all** fields the controller uses from `req.body` — no field has been added to the controller without a corresponding schema addition.
- [ ] String fields have `.max()` constraints to prevent oversized payloads.
- [ ] Numeric fields are `.positive()` / `.int()` where appropriate.
- [ ] Enum fields use `z.enum(...)` tied to the Prisma enum, not free-text strings.
- [ ] Optional fields that were added after the original schema was written have been cross-checked.
- [ ] The `validate()` middleware runs **before** the controller (middleware ordering in the route file is correct).

**Schema files to check:**

| Schema | File |
|--------|------|
| `DepositSchema` | `src/schemas/custodian.schemas.ts` |
| `ExitSchema` | `src/schemas/custodian.schemas.ts` |
| `OnboardCustodianSchema` | `src/schemas/custodian.schemas.ts` |
| `GenerateApiKeySchema` | `src/schemas/custodian.schemas.ts` |
| `LoginSchema` | `src/schemas/auth.schemas.ts` |
| `LockSchema` / `UnlockSchema` | `src/schemas/lender.schemas.ts` |
| `TransferSchema` | `src/schemas/farmer.schemas.ts` |
| `SplitTokenSchema` | `src/schemas/index.ts` |
| `PresignUploadSchema` | `src/schemas/upload.schemas.ts` |

---

### 5  Helmet / HTTP security headers

No action required per endpoint — Helmet is applied globally in `app.ts`.  
Verify after any middleware reorder:

- [ ] `helmet(...)` is still the **first** middleware registered on `app`.
- [ ] CSP `default-src` remains `'none'` (this is a JSON API, not a browser app).
- [ ] `frame-ancestors 'none'` is present in the CSP (prevents click-jacking).
- [ ] HSTS `maxAge` is ≥ 365 days and `includeSubDomains` is set.
- [ ] `X-Powered-By` header is hidden.

---

### 6  Sensitive data in responses

- [ ] API keys are never returned after creation; only the hash is stored.
- [ ] JWT secrets, admin secrets, and database URLs are not logged or returned in error messages.
- [ ] Stack traces are stripped from production error responses (handled by `errorHandler` in `src/middleware/error.middleware.ts`).
- [ ] Farmer phone numbers and PIN hashes are never serialised into API responses.

---

### 7  Logging & audit trail

- [ ] Destructive operations (burn/exit, lock/unlock, key generation) log enough context (token ID, actor, timestamp) to reconstruct what happened.
- [ ] No sensitive values (secrets, raw API keys, PINs) appear in log output.
- [ ] Errors are logged with `console.error` or the structured logger, not silently swallowed.

---

### 8  Database / ORM hygiene

- [ ] All user-supplied values flow through Prisma's parameterised query API — no raw string interpolation into SQL.
- [ ] Prisma `select` / `include` lists only the fields the endpoint actually needs (no over-fetching of sensitive columns).

---

### 9  Dependency hygiene

- [ ] Run `npm audit` — no high/critical vulnerabilities that affect this code path.
- [ ] New third-party packages have been reviewed (license, maintenance status, supply-chain risk).

---

### 10  Tests

- [ ] New endpoint has at least one happy-path test and one validation-failure test.
- [ ] `npm test` passes locally before pushing.
- [ ] `npx tsc --noEmit` passes (no type errors).

---

## Reference

| File | Purpose |
|------|---------|
| `src/app.ts` | Global CORS + Helmet setup |
| `src/config/env.ts` | `ALLOWED_ORIGINS` and other env var definitions |
| `src/middleware/validate.middleware.ts` | Zod body-validation middleware factory |
| `src/middleware/auth.middleware.ts` | JWT (`requireJWT`) and API-key (`requireAPIKey`) guards |
| `src/middleware/error.middleware.ts` | Global error handler (strips stack traces in production) |
| `src/schemas/` | All Zod schemas — one file per domain |
| `tests/security.test.ts` | Automated security header + validation tests |
| `docs/SECURITY_CHECKLIST.md` | This file |
