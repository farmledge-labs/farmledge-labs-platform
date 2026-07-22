# Token Lineage Feature

## Overview

The Token Lineage feature tracks parent-child relationships between tokens when a token is split. This enables farmers to split a single warehouse receipt token into two smaller tokens while maintaining a complete audit trail of the split operation.

## Database Schema

### Token Model Fields

The `Token` model includes three fields related to lineage:

```prisma
model Token {
  // ... other fields ...

  /// The tokenId of the parent token from which this token was minted by a Split operation.
  /// Null for root tokens that were not created by a split.
  /// Both children produced by a single split share the same parentTokenId value.
  parentTokenId String?
  
  /// Relation to the parent token. Used to traverse from child to parent.
  parent        Token?  @relation("TokenLineage", fields: [parentTokenId], references: [tokenId])
  
  /// Relation to all child tokens created by splitting this token.
  /// A token that has never been split will have an empty children array.
  children      Token[] @relation("TokenLineage")
}
```

### Key Characteristics

- **Self-referential relationship**: The `parentTokenId` field references the `tokenId` field of another token in the same table
- **Optional parent**: Root tokens (tokens not created by splitting) have `parentTokenId = null`
- **Multiple children**: A parent token can have multiple children (typically 2 for a split operation)
- **Foreign key constraint**: The database enforces that `parentTokenId` must reference a valid `tokenId` or be null
- **Cascade behavior**:
  - `ON DELETE SET NULL`: If a parent token is deleted, children's `parentTokenId` is set to null
  - `ON UPDATE CASCADE`: If a parent's `tokenId` changes, children's `parentTokenId` updates automatically

## Use Cases

### 1. Token Split Operation

When a farmer wants to split a 50-bag token into a 20-bag token and a 30-bag token:

```typescript
// 1. Mark the parent token as exited (burned)
await prisma.token.update({
  where: { tokenId: 'KN-2026-000007' },
  data: { 
    status: 'exited',
    exitDate: new Date()
  }
})

// 2. Create first child token
await prisma.token.create({
  data: {
    tokenId: 'KN-2026-000008',
    bagCount: 20,
    totalWeightKg: 2000,
    parentTokenId: 'KN-2026-000007', // Reference parent
    // ... other required fields
  }
})

// 3. Create second child token
await prisma.token.create({
  data: {
    tokenId: 'KN-2026-000009',
    bagCount: 30,
    totalWeightKg: 3000,
    parentTokenId: 'KN-2026-000007', // Reference same parent
    // ... other required fields
  }
})
```

### 2. Querying Lineage

**Get a token's parent:**

```typescript
const childToken = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000008' },
  include: { parent: true }
})

console.log(childToken.parent) // Parent token object
```

**Get a token's children:**

```typescript
const parentToken = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000007' },
  include: { children: true }
})

console.log(parentToken.children) // Array of child tokens
```

**Multi-level lineage (grandchildren):**

```typescript
const grandchild = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000010' },
  include: {
    parent: {
      include: {
        parent: true // Grandparent
      }
    }
  }
})
```

### 3. Auditing and Traceability

The lineage feature enables:
- **Complete audit trail**: Track the origin of any token back to its root
- **Quantity verification**: Verify that child tokens' total weight equals parent weight
- **Split history**: See how many times a token lineage has been split
- **Ownership tracking**: Ensure all children maintain proper farmer ownership

## Business Rules

### Quantity Conservation

When splitting a token, the sum of children weights must equal the parent weight:

```
parent.totalWeightKg = child1.totalWeightKg + child2.totalWeightKg
```

Example:
- Parent: 50 bags × 100kg = 5000kg
- Child 1: 20 bags × 100kg = 2000kg
- Child 2: 30 bags × 100kg = 3000kg
- Verification: 2000kg + 3000kg = 5000kg ✓

### Parent Token Lifecycle

When a token is split:
1. Parent token status changes to `exited`
2. Parent token `exitDate` is set to the split timestamp
3. Two new child tokens are created with `status = active`
4. Both children have `parentTokenId` set to the parent's `tokenId`

### Invariants

The system must maintain these invariants:

1. **No self-reference**: A token cannot be its own parent
2. **Valid parent reference**: `parentTokenId` must reference an existing `tokenId` or be null
3. **Root tokens**: Tokens with `parentTokenId = null` are root tokens (not created by split)
4. **Shared parent**: Both children from a single split share the same `parentTokenId`
5. **Lineage integrity**: Deleting a parent doesn't delete children (cascades to null)

## Testing

Comprehensive tests are available in `tests/token-lineage.test.ts`:

- Root token creation (`parentTokenId = null`)
- Child token creation with valid parent reference
- Sibling tokens sharing the same parent
- Relation traversal (parent ↔ children)
- Multi-level lineage (grandchildren)
- Foreign key constraint enforcement
- Cascade behavior (DELETE and UPDATE)
- Quantity conservation verification

Run tests:

```bash
npm test # Run all tests including lineage tests
```

## Example Data

The seed file (`prisma/seed.ts`) includes an example lineage:

- **KN-2026-000007**: Parent token (50 bags, exited after split)
- **KN-2026-000008**: First child (20 bags, active)
- **KN-2026-000009**: Second child (30 bags, active)

Query this example:

```bash
npm run db:seed # Populate database with example data
```

## Migration

The lineage feature was added via migration `20260722000000_add_token_lineage`:

```sql
-- Add nullable parentTokenId column
ALTER TABLE "tokens" ADD COLUMN "parentTokenId" TEXT;

-- Add foreign key constraint with cascade rules
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_parentTokenId_fkey" 
  FOREIGN KEY ("parentTokenId") 
  REFERENCES "tokens"("tokenId") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;
```

## Future Enhancements

Potential improvements to the lineage feature:

1. **Split history API**: Endpoint to get complete split history for a token lineage
2. **Lineage visualization**: UI component showing parent-child tree structure
3. **Merge operation**: Combine two sibling tokens back into one (reverse split)
4. **Split validation**: Enforce quantity conservation at the database level with triggers
5. **Lineage depth limit**: Prevent excessive splitting by limiting lineage depth
6. **Split authorization**: Add lender approval requirement for locked tokens

## API Endpoints (Future)

When the Split feature is implemented, these endpoints will be added:

```
POST   /api/v1/tokens/:token_id/split
  - Request: { child1BagCount, child2BagCount }
  - Response: { parent, child1, child2 }

GET    /api/v1/tokens/:token_id/lineage
  - Response: { ancestors: [], descendants: [], depth: number }

GET    /api/v1/tokens/:token_id/siblings
  - Response: { siblings: [] }
```

## Related Documentation

- [Prisma Schema](../prisma/schema.prisma) - Full database schema
- [Token Model Tests](../tests/token-lineage.test.ts) - Lineage test suite
- [Seed Data](../prisma/seed.ts) - Example lineage data
