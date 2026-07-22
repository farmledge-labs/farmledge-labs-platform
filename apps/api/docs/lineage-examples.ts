/**
 * TypeScript Examples for Token Lineage Feature
 * These examples demonstrate proper usage of the parentTokenId field.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Example 1: Create root token (parentTokenId defaults to null)
async function createRootToken() {
  return await prisma.token.create({
    data: {
      tokenId: 'KN-2026-000100',
      commodity: 'MAIZE_WHITE',
      grade: 'Grade_A',
      bagCount: 50,
      weightPerBagKg: 100,
      totalWeightKg: 5000,
      status: 'active',
      isLocked: false,
      txHash: 'TX100ABC',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX100ABC',
      farmerId: 'farmer-uuid',
      warehouseId: 'warehouse-uuid',
      // parentTokenId omitted - defaults to null
    },
  })
}

// Example 2: Create child token with parent reference
async function createChildToken(parentTokenId: string) {
  return await prisma.token.create({
    data: {
      tokenId: 'KN-2026-000101',
      commodity: 'MAIZE_WHITE',
      grade: 'Grade_A',
      bagCount: 20,
      weightPerBagKg: 100,
      totalWeightKg: 2000,
      status: 'active',
      isLocked: false,
      txHash: 'TX101ABC',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX101ABC',
      farmerId: 'farmer-uuid',
      warehouseId: 'warehouse-uuid',
      parentTokenId, // Set parent reference
    },
  })
}

// Example 3: Query with parent relation
async function getTokenWithParent(tokenId: string) {
  const token = await prisma.token.findUnique({
    where: { tokenId },
    include: { parent: true },
  })
  
  if (token?.parent) {
    console.log(`Parent: ${token.parent.tokenId}`)
  }
  
  return token
}

// Example 4: Query with children relation
async function getTokenWithChildren(tokenId: string) {
  const token = await prisma.token.findUnique({
    where: { tokenId },
    include: { children: true },
  })
  
  console.log(`Children count: ${token?.children.length || 0}`)
  
  return token
}
