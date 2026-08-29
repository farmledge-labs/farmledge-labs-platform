# Token Lineage - Quick Start Guide

Quick reference for working with the token lineage feature.

## TL;DR

Tokens now have `parentTokenId` to track splits. Root tokens have `null`, child tokens reference their parent's `tokenId`.

## Basic Usage

### Creating Tokens

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Root token (no parent)
const root = await prisma.token.create({
  data: {
    tokenId: 'KN-2026-000100',
    // ... other required fields
    // parentTokenId omitted → defaults to null
  }
})

// Child token (from split)
const child = await prisma.token.create({
  data: {
    tokenId: 'KN-2026-000101',
    parentTokenId: root.tokenId, // Reference parent
    // ... other required fields
  }
})
```

### Querying Lineage

```typescript
// Get token with parent
const token = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000008' },
  include: { parent: true }
})
console.log(token.parent?.tokenId) // Parent's tokenId

// Get token with children
const parent = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000007' },
  include: { children: true }
})
console.log(parent.children.length) // Number of children
```

## Database Schema

```prisma
model Token {
  parentTokenId String?   // Null for root tokens
  parent        Token?  @relation("TokenLineage", fields: [parentTokenId], references: [tokenId])
  children      Token[] @relation("TokenLineage")
}
```

## Example Split Operation (Pseudocode)

```typescript
async function splitToken(parentTokenId: string, child1Bags: number, child2Bags: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get parent token
    const parent = await tx.token.findUnique({ 
      where: { tokenId: parentTokenId } 
    })
    
    // 2. Validate
    if (child1Bags + child2Bags !== parent.bagCount) {
      throw new Error('Quantity must be conserved')
    }
    
    // 3. Mark parent as exited (burned)
    await tx.token.update({
      where: { tokenId: parentTokenId },
      data: { status: 'exited', exitDate: new Date() }
    })
    
    // 4. Create child 1
    const child1 = await tx.token.create({
      data: {
        tokenId: generateTokenId(),
        bagCount: child1Bags,
        totalWeightKg: child1Bags * parent.weightPerBagKg,
        parentTokenId: parent.tokenId, // Link to parent
        // ... copy other fields from parent
      }
    })
    
    // 5. Create child 2
    const child2 = await tx.token.create({
      data: {
        tokenId: generateTokenId(),
        bagCount: child2Bags,
        totalWeightKg: child2Bags * parent.weightPerBagKg,
        parentTokenId: parent.tokenId, // Link to parent
        // ... copy other fields from parent
      }
    })
    
    return { parent, child1, child2 }
  })
}
```

## Key Rules

1. **Root tokens**: `parentTokenId = null`
2. **Child tokens**: `parentTokenId = parent.tokenId`
3. **Siblings**: Both children from a split share the same `parentTokenId`
4. **Quantity conservation**: `child1.totalWeightKg + child2.totalWeightKg = parent.totalWeightKg`
5. **Atomicity**: Use transactions for split operations

## Common Queries

```typescript
// Find all root tokens (no parent)
const rootTokens = await prisma.token.findMany({
  where: { parentTokenId: null }
})

// Find all children of a token
const children = await prisma.token.findMany({
  where: { parentTokenId: 'KN-2026-000007' }
})

// Find siblings (tokens with same parent)
const token = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000008' }
})
const siblings = await prisma.token.findMany({
  where: { 
    parentTokenId: token.parentTokenId,
    tokenId: { not: token.tokenId } // Exclude self
  }
})

// Get full lineage tree
const tokenWithLineage = await prisma.token.findUnique({
  where: { tokenId: 'KN-2026-000008' },
  include: {
    parent: {
      include: {
        parent: true, // Grandparent
        children: true // Siblings
      }
    },
    children: true // Own children
  }
})
```

## Testing

```bash
# Run lineage tests
npm test -- token-lineage.test.ts

# All tests
npm test
```

## Example Data

See tokens in seed file:
- **KN-2026-000007**: Parent (50 bags, exited)
- **KN-2026-000008**: Child 1 (20 bags)
- **KN-2026-000009**: Child 2 (30 bags)

```bash
npm run db:seed
```

## Documentation

- Full feature docs: `docs/TOKEN_LINEAGE.md`
- Verification guide: `docs/LINEAGE_VERIFICATION.md`
- Code examples: `docs/lineage-examples.ts`

## Troubleshooting

**Foreign key violation?**
- Ensure parent token exists before creating child
- Use `tokenId` not `id` for parent reference

**Type errors?**
- Run `npx prisma generate` to regenerate types

**Tests failing?**
- Check database connection
- Ensure migrations applied: `npx prisma migrate dev`

## Quick Commands

```bash
cd apps/api

# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate dev

# Run tests
npm test

# Seed database
npm run db:seed

# Open Prisma Studio
npx prisma studio
```
