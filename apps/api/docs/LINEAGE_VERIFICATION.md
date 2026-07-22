# Token Lineage Feature - Verification Checklist

This document provides step-by-step instructions to verify that the token lineage feature is working correctly.

## Prerequisites

Before starting verification:
- [ ] Node.js 20+ installed
- [ ] PostgreSQL 16 running (via Docker or local)
- [ ] Dependencies installed (`npm install` in project root)
- [ ] Environment variables configured (`apps/api/.env`)

## Step 1: Database Migration

Verify the migration has been applied:

```bash
cd apps/api

# Check migration status
npx prisma migrate status

# Expected output:
# Database schema is up to date!
# 
# The following migrations have been applied:
# migrations/
#   └─ 20260720121157_add_lender_apikey/
#   └─ 20260722000000_add_token_lineage/
```

If migrations are not applied:

```bash
npx prisma migrate dev
```

## Step 2: Prisma Client Generation

Generate the TypeScript client with updated types:

```bash
npx prisma generate

# Expected output:
# ✔ Generated Prisma Client...
```

Verify the generated types:

```bash
# Check that parentTokenId is in the generated types
grep -r "parentTokenId" node_modules/.prisma/client/index.d.ts
```

## Step 3: TypeScript Compilation

Verify no type errors:

```bash
npx tsc --noEmit

# Expected: No output (success)
# If there are errors, they will be listed
```

## Step 4: Database Schema Inspection

Connect to PostgreSQL and inspect the schema:

```bash
# Using psql
psql $DATABASE_URL

# Or using Prisma Studio
npx prisma studio
```

In psql, verify the column exists:

```sql
\d tokens

-- Look for:
-- parentTokenId | text | nullable
-- 
-- Foreign-key constraints:
--   "tokens_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") 
--   REFERENCES tokens("tokenId") ON UPDATE CASCADE ON DELETE SET NULL
```

## Step 5: Seed Database

Populate with example data including lineage:

```bash
npm run db:seed

# Expected output:
# 🌱 Seeding database...
# ✔ Farmers: Aminu Musa, Fatima Bello, Chukwuemeka Obi
# ✔ Warehouses: Kano Central Grain Store, Kaduna Agricultural Depot
# ✔ Tokens: KN-2026-000001 through KN-2026-000009
#   - KN-2026-000007 (parent, exited) → KN-2026-000008 + KN-2026-000009 (children, active)
#   - Demonstrates token lineage: 50 bags split into 20 + 30 bags
# ✅ Seeding complete.
```

## Step 6: Manual Database Queries

Verify the lineage data directly in the database:

```sql
-- Query 1: Check all tokens with their parent references
SELECT 
  "tokenId",
  "bagCount",
  "parentTokenId",
  status
FROM tokens
WHERE "tokenId" IN ('KN-2026-000007', 'KN-2026-000008', 'KN-2026-000009')
ORDER BY "tokenId";

-- Expected results:
-- tokenId            | bagCount | parentTokenId      | status
-- -------------------+----------+--------------------+-----------
-- KN-2026-000007     | 50       | null               | exited
-- KN-2026-000008     | 20       | KN-2026-000007     | active
-- KN-2026-000009     | 30       | KN-2026-000007     | active


-- Query 2: Verify quantity conservation
SELECT 
  p."tokenId" as parent_token,
  p."totalWeightKg" as parent_weight,
  SUM(c."totalWeightKg") as children_weight_sum,
  p."totalWeightKg" = SUM(c."totalWeightKg") as weights_match
FROM tokens p
JOIN tokens c ON c."parentTokenId" = p."tokenId"
WHERE p."tokenId" = 'KN-2026-000007'
GROUP BY p."tokenId", p."totalWeightKg";

-- Expected:
-- parent_token      | parent_weight | children_weight_sum | weights_match
-- ------------------+---------------+--------------------+--------------
-- KN-2026-000007    | 5000          | 5000               | t


-- Query 3: Test foreign key constraint
-- This should fail with foreign key violation
INSERT INTO tokens (
  id, "tokenId", commodity, grade, "bagCount", 
  "weightPerBagKg", "totalWeightKg", status, "isLocked",
  "txHash", "stellarExplorerLink", "farmerId", "warehouseId",
  "parentTokenId"
)
VALUES (
  gen_random_uuid(), 
  'TEST-INVALID-001',
  'MAIZE_WHITE',
  'Grade_A',
  10,
  100,
  1000,
  'active',
  false,
  'TX_INVALID',
  'https://example.com',
  (SELECT id FROM farmers LIMIT 1),
  (SELECT id FROM warehouses LIMIT 1),
  'NONEXISTENT-TOKEN-ID' -- This should cause FK violation
);

-- Expected error:
-- ERROR: insert or update on table "tokens" violates foreign key constraint "tokens_parentTokenId_fkey"
```

## Step 7: Run Test Suite

Execute the comprehensive test suite:

```bash
npm test

# Expected output (partial):
# ▶ Token Lineage - Database Integration
#   ✔ Root token has null parentTokenId
#   ✔ Child token has correct parentTokenId
#   ✔ Two children from same parent share the same parentTokenId
#   ✔ Relation traversal - child to parent
#   ✔ Relation traversal - parent to children
#   ✔ Root token has empty children array when not split
#   ✔ Grandchild lineage - three levels deep
#   ✔ Foreign key constraint - invalid parentTokenId throws error
#   ✔ Token cannot be its own parent
#   ✔ Deleting parent sets children parentTokenId to null
#   ✔ Updating parent tokenId cascades to children
# ▶ Token Lineage - Quantity Conservation
#   ✔ Split quantity conservation - parent weight equals sum of children weights
#
# ℹ tests 12
# ℹ suites 0
# ℹ pass 12
# ℹ fail 0
```

## Step 8: Prisma Studio Visual Verification

Open Prisma Studio to visually inspect relationships:

```bash
npx prisma studio

# Browser opens at http://localhost:5555
```

In Prisma Studio:
1. Navigate to "Token" model
2. Find token `KN-2026-000008`
3. Click on the `parent` relation → should show `KN-2026-000007`
4. Go to token `KN-2026-000007`
5. Click on the `children` relation → should show 2 children

## Step 9: TypeScript Usage Test

Create a simple test script:

```bash
# Create test file
cat > apps/api/test-lineage.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testLineage() {
  // Test 1: Get child with parent
  const child = await prisma.token.findUnique({
    where: { tokenId: 'KN-2026-000008' },
    include: { parent: true }
  })
  
  console.log('✓ Child token:', child?.tokenId)
  console.log('✓ Parent token:', child?.parent?.tokenId)
  console.log('✓ Parent has', child?.parent?.bagCount, 'bags')
  
  // Test 2: Get parent with children
  const parent = await prisma.token.findUnique({
    where: { tokenId: 'KN-2026-000007' },
    include: { children: true }
  })
  
  console.log('✓ Parent token:', parent?.tokenId)
  console.log('✓ Number of children:', parent?.children.length)
  console.log('✓ Child 1:', parent?.children[0]?.tokenId, '-', parent?.children[0]?.bagCount, 'bags')
  console.log('✓ Child 2:', parent?.children[1]?.tokenId, '-', parent?.children[1]?.bagCount, 'bags')
  
  await prisma.$disconnect()
}

testLineage().catch(console.error)
EOF

# Run the test
npx tsx test-lineage.ts

# Expected output:
# ✓ Child token: KN-2026-000008
# ✓ Parent token: KN-2026-000007
# ✓ Parent has 50 bags
# ✓ Parent token: KN-2026-000007
# ✓ Number of children: 2
# ✓ Child 1: KN-2026-000008 - 20 bags
# ✓ Child 2: KN-2026-000009 - 30 bags

# Clean up
rm apps/api/test-lineage.ts
```

## Step 10: Cascade Behavior Test

Test ON DELETE SET NULL:

```sql
-- Create a test parent and child
INSERT INTO tokens (
  id, "tokenId", commodity, grade, "bagCount", "weightPerBagKg", 
  "totalWeightKg", status, "isLocked", "txHash", "stellarExplorerLink",
  "farmerId", "warehouseId", "parentTokenId"
) VALUES (
  gen_random_uuid(),
  'TEST-PARENT-CASCADE',
  'MAIZE_WHITE',
  'Grade_A',
  100,
  100,
  10000,
  'active',
  false,
  'TX_TEST_PARENT',
  'https://example.com/parent',
  (SELECT id FROM farmers LIMIT 1),
  (SELECT id FROM warehouses LIMIT 1),
  null
);

INSERT INTO tokens (
  id, "tokenId", commodity, grade, "bagCount", "weightPerBagKg", 
  "totalWeightKg", status, "isLocked", "txHash", "stellarExplorerLink",
  "farmerId", "warehouseId", "parentTokenId"
) VALUES (
  gen_random_uuid(),
  'TEST-CHILD-CASCADE',
  'MAIZE_WHITE',
  'Grade_A',
  50,
  100,
  5000,
  'active',
  false,
  'TX_TEST_CHILD',
  'https://example.com/child',
  (SELECT id FROM farmers LIMIT 1),
  (SELECT id FROM warehouses LIMIT 1),
  'TEST-PARENT-CASCADE'
);

-- Verify child has parent
SELECT "tokenId", "parentTokenId" FROM tokens WHERE "tokenId" = 'TEST-CHILD-CASCADE';
-- Should show: TEST-CHILD-CASCADE | TEST-PARENT-CASCADE

-- Delete parent
DELETE FROM tokens WHERE "tokenId" = 'TEST-PARENT-CASCADE';

-- Verify child's parentTokenId is now null (ON DELETE SET NULL)
SELECT "tokenId", "parentTokenId" FROM tokens WHERE "tokenId" = 'TEST-CHILD-CASCADE';
-- Should show: TEST-CHILD-CASCADE | null

-- Clean up
DELETE FROM tokens WHERE "tokenId" = 'TEST-CHILD-CASCADE';
```

## Verification Checklist

- [ ] Migration `20260722000000_add_token_lineage` is applied
- [ ] `parentTokenId` column exists in `tokens` table
- [ ] Foreign key constraint `tokens_parentTokenId_fkey` exists
- [ ] Prisma Client generated with updated types
- [ ] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [ ] All 12 lineage tests pass
- [ ] Seed data creates example lineage correctly
- [ ] Parent-child relationships queryable via Prisma
- [ ] Foreign key constraint prevents invalid references
- [ ] ON DELETE SET NULL behavior verified
- [ ] ON UPDATE CASCADE behavior verified
- [ ] Quantity conservation verified (2000 + 3000 = 5000)
- [ ] Root tokens have `parentTokenId = null`
- [ ] Child tokens have valid `parentTokenId` reference
- [ ] Prisma Studio shows relations correctly

## Troubleshooting

### Issue: Migration not applied

```bash
npx prisma migrate deploy  # Production
# or
npx prisma migrate dev     # Development
```

### Issue: TypeScript errors about parentTokenId

```bash
# Regenerate Prisma Client
npx prisma generate

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Tests failing

```bash
# Check database connection
npx prisma db pull

# Reset database and reapply migrations
npx prisma migrate reset  # WARNING: Deletes all data

# Run specific test
npx tsx --test tests/token-lineage.test.ts
```

### Issue: Foreign key violations

Check that:
1. Parent token exists before creating child
2. `parentTokenId` references `tokenId` (not `id`)
3. Referenced token has a valid `tokenId` value

## Success Criteria

✅ All checklist items completed
✅ All tests pass
✅ TypeScript compiles without errors
✅ Seed data demonstrates working lineage
✅ Manual queries confirm relationships
✅ Cascade rules work correctly
✅ Foreign key constraints enforced

The token lineage feature is fully functional and ready for the Split API implementation!
