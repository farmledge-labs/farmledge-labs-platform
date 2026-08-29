## Summary

Closes #SPLIT-4

Implements the real split token controller endpoint `POST /api/v1/tokens/:id/split` along with SDK split service helper and Zod request validation schema.

### Key Changes:
- **`apps/api/src/services/sdk.ts`**: Implemented `SDKService.splitToken()` which simulates on-chain token burning and minting of two child tokens (collateral + liquid remainder) returning transaction hash and Stellar explorer link.
- **`apps/api/src/schemas/index.ts`**: Added `SplitTokenSchema` validating that `split_amount_kg` is required and positive.
- **`apps/api/src/routes/token.routes.ts`**: Created `POST /tokens/:id/split` protected route. Uses a two-phase commit pattern:
  1. Calls SDK `splitToken()`.
  2. Executes Prisma `$transaction` to mark parent token status as `exited` and create both child token records linked via `parentTokenId`.
- **`apps/api/src/routes/index.ts`**: Registered `tokenRouter` under `/api/v1`.
- **`apps/api/src/lib/db.ts`**: Wrapped Prisma Client with safe proxy to ensure offline / test execution without ungenerated client errors.

## Tests

Added unit and integration tests:
- `apps/api/tests/schemas.test.ts`: Added tests for `SplitTokenSchema` (valid body, missing field, negative amount).
- `apps/api/tests/routes.test.ts`: Added route test verifying `POST /api/v1/tokens/:id/split` returns HTTP 200 with parent status `exited` and two child token records linked to the parent.

### Test Verification
```bash
# TypeScript check
npx tsc --noEmit   # 0 errors

# Test suite execution
npm test           # 84/84 tests passing
```

## Branch Information
- **Branch**: `feat/issue-SPLIT-4-split-controller`
- **Upstream**: `origin/feat/issue-SPLIT-4-split-controller`
