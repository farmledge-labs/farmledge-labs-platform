import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient, Commodity, Grade, TokenStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Test data helpers
const createTestFarmer = async () => {
  return await prisma.farmer.create({
    data: {
      fullName: 'Test Farmer',
      phone: `0812${Date.now().toString().slice(-7)}`,
      stellarWallet: `GTEST${Date.now()}ABCDEFGHIJKLMNOPQRSTUVWXYZ`,
      bvnVerified: true,
    },
  })
}

const createTestWarehouse = async () => {
  return await prisma.warehouse.create({
    data: {
      name: 'Test Warehouse',
      location: 'Test Location',
      state: 'Test State',
      certified: true,
      capacityTonnes: 1000,
      custodianWallet: `GCUSTODIAN${Date.now()}ABCDEFGHIJKLMNOPQRSTUVWXYZ`,
    },
  })
}

const createTestToken = async (
  farmerId: string,
  warehouseId: string,
  parentTokenId?: string | null,
  tokenIdSuffix?: string
) => {
  const tokenId = `TEST-2026-${tokenIdSuffix || Date.now().toString().slice(-6)}`
  return await prisma.token.create({
    data: {
      tokenId,
      commodity: Commodity.MAIZE_WHITE,
      grade: Grade.Grade_A,
      bagCount: 40,
      weightPerBagKg: 100,
      totalWeightKg: 4000,
      status: TokenStatus.active,
      isLocked: false,
      txHash: `TX${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
      stellarExplorerLink: `https://stellar.expert/explorer/testnet/tx/${tokenId}`,
      farmerId,
      warehouseId,
      parentTokenId: parentTokenId === null ? null : parentTokenId,
    },
  })
}

describe('Token Lineage - Database Integration', () => {
  let testFarmer: Awaited<ReturnType<typeof createTestFarmer>>
  let testWarehouse: Awaited<ReturnType<typeof createTestWarehouse>>

  before(async () => {
    testFarmer = await createTestFarmer()
    testWarehouse = await createTestWarehouse()
  })

  after(async () => {
    // Cleanup test data - delete in correct order due to foreign keys
    await prisma.token.deleteMany({
      where: {
        OR: [
          { farmerId: testFarmer.id },
          { tokenId: { startsWith: 'TEST-2026-' } },
        ],
      },
    })
    await prisma.farmer.deleteMany({ where: { id: testFarmer.id } })
    await prisma.warehouse.deleteMany({ where: { id: testWarehouse.id } })
    await prisma.$disconnect()
  })

  test('Root token has null parentTokenId', async () => {
    const rootToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'ROOT01')

    assert.equal(rootToken.parentTokenId, null, 'Root token should have null parentTokenId')

    // Verify by querying
    const queriedToken = await prisma.token.findUnique({
      where: { tokenId: rootToken.tokenId },
    })

    assert.notEqual(queriedToken, null, 'Token should exist in database')
    assert.equal(queriedToken?.parentTokenId, null, 'Queried root token should have null parentTokenId')
  })

  test('Child token has correct parentTokenId', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT01')
    const childToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD01'
    )

    assert.equal(
      childToken.parentTokenId,
      parentToken.tokenId,
      'Child token parentTokenId should match parent tokenId'
    )
    assert.notEqual(childToken.parentTokenId, null, 'Child token should have non-null parentTokenId')

    // Verify by querying
    const queriedChild = await prisma.token.findUnique({
      where: { tokenId: childToken.tokenId },
    })

    assert.equal(
      queriedChild?.parentTokenId,
      parentToken.tokenId,
      'Queried child should have correct parentTokenId'
    )
  })

  test('Two children from same parent share the same parentTokenId', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT02')
    const child1 = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD02A'
    )
    const child2 = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD02B'
    )

    assert.equal(
      child1.parentTokenId,
      parentToken.tokenId,
      'First child should reference parent'
    )
    assert.equal(
      child2.parentTokenId,
      parentToken.tokenId,
      'Second child should reference parent'
    )
    assert.equal(
      child1.parentTokenId,
      child2.parentTokenId,
      'Both children should have the same parentTokenId'
    )
  })

  test('Relation traversal - child to parent', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT03')
    const childToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD03'
    )

    const childWithParent = await prisma.token.findUnique({
      where: { tokenId: childToken.tokenId },
      include: { parent: true },
    })

    assert.notEqual(childWithParent, null, 'Child token should be found')
    assert.notEqual(childWithParent?.parent, null, 'Parent relation should be populated')
    assert.equal(
      childWithParent?.parent?.tokenId,
      parentToken.tokenId,
      'Parent tokenId should match'
    )
    assert.equal(
      childWithParent?.parent?.id,
      parentToken.id,
      'Parent id should match'
    )
  })

  test('Relation traversal - parent to children', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT04')
    const child1 = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD04A'
    )
    const child2 = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD04B'
    )

    const parentWithChildren = await prisma.token.findUnique({
      where: { tokenId: parentToken.tokenId },
      include: { children: true },
    })

    assert.notEqual(parentWithChildren, null, 'Parent token should be found')
    assert.equal(parentWithChildren?.children.length, 2, 'Parent should have 2 children')

    const childTokenIds = parentWithChildren?.children.map((c) => c.tokenId).sort()
    const expectedTokenIds = [child1.tokenId, child2.tokenId].sort()
    assert.deepEqual(childTokenIds, expectedTokenIds, 'Children tokenIds should match')
  })

  test('Root token has empty children array when not split', async () => {
    const rootToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'ROOT05')

    const tokenWithChildren = await prisma.token.findUnique({
      where: { tokenId: rootToken.tokenId },
      include: { children: true },
    })

    assert.notEqual(tokenWithChildren, null, 'Root token should be found')
    assert.equal(
      tokenWithChildren?.children.length,
      0,
      'Root token with no splits should have empty children array'
    )
  })

  test('Grandchild lineage - three levels deep', async () => {
    // Create root -> child -> grandchild
    const rootToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'ROOT06')
    const childToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      rootToken.tokenId,
      'CHILD06'
    )
    const grandchildToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      childToken.tokenId,
      'GRANDCHILD06'
    )

    // Verify grandchild points to child, not root
    assert.equal(
      grandchildToken.parentTokenId,
      childToken.tokenId,
      'Grandchild should reference child, not root'
    )
    assert.notEqual(
      grandchildToken.parentTokenId,
      rootToken.tokenId,
      'Grandchild should NOT reference root directly'
    )

    // Traverse from grandchild to child to root
    const grandchildWithParent = await prisma.token.findUnique({
      where: { tokenId: grandchildToken.tokenId },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
      },
    })

    assert.equal(
      grandchildWithParent?.parent?.tokenId,
      childToken.tokenId,
      'Grandchild parent should be child'
    )
    assert.equal(
      grandchildWithParent?.parent?.parent?.tokenId,
      rootToken.tokenId,
      'Child parent should be root'
    )
  })

  test('Foreign key constraint - invalid parentTokenId throws error', async () => {
    const invalidParentTokenId = 'NONEXISTENT-TOKEN-ID'

    await assert.rejects(
      async () => {
        await createTestToken(testFarmer.id, testWarehouse.id, invalidParentTokenId, 'INVALID01')
      },
      (err: any) => {
        // Prisma throws P2003 for foreign key constraint violations
        return err.code === 'P2003' || err.message.includes('foreign key')
      },
      'Creating token with non-existent parentTokenId should fail with foreign key constraint error'
    )
  })

  test('Token cannot be its own parent', async () => {
    // Create a token first
    const token = await createTestToken(testFarmer.id, testWarehouse.id, null, 'CIRCULAR01')

    // Attempt to update it to be its own parent
    await assert.rejects(
      async () => {
        await prisma.token.update({
          where: { tokenId: token.tokenId },
          data: { parentTokenId: token.tokenId },
        })
      },
      (err: any) => {
        // This should fail with a foreign key constraint violation
        // because the tokenId references itself
        return err.code === 'P2003' || err.message.includes('foreign key')
      },
      'Token should not be able to reference itself as parent'
    )
  })

  test('Deleting parent sets children parentTokenId to null (ON DELETE SET NULL)', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT07')
    const childToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD07'
    )

    // Verify child has parent
    assert.equal(childToken.parentTokenId, parentToken.tokenId, 'Child should have parent initially')

    // Delete parent token
    await prisma.token.delete({
      where: { tokenId: parentToken.tokenId },
    })

    // Check that child's parentTokenId is now null
    const orphanedChild = await prisma.token.findUnique({
      where: { tokenId: childToken.tokenId },
    })

    assert.equal(
      orphanedChild?.parentTokenId,
      null,
      'Child parentTokenId should be null after parent deletion (ON DELETE SET NULL)'
    )
  })

  test('Updating parent tokenId cascades to children (ON UPDATE CASCADE)', async () => {
    const parentToken = await createTestToken(testFarmer.id, testWarehouse.id, null, 'PARENT08')
    const childToken = await createTestToken(
      testFarmer.id,
      testWarehouse.id,
      parentToken.tokenId,
      'CHILD08'
    )

    const newTokenId = 'TEST-2026-UPDATED08'

    // Update parent's tokenId
    await prisma.token.update({
      where: { tokenId: parentToken.tokenId },
      data: { tokenId: newTokenId },
    })

    // Check that child's parentTokenId was updated
    const childAfterUpdate = await prisma.token.findUnique({
      where: { tokenId: childToken.tokenId },
    })

    assert.equal(
      childAfterUpdate?.parentTokenId,
      newTokenId,
      'Child parentTokenId should cascade to new parent tokenId (ON UPDATE CASCADE)'
    )
  })
})

describe('Token Lineage - Quantity Conservation (Business Logic)', () => {
  let testFarmer: Awaited<ReturnType<typeof createTestFarmer>>
  let testWarehouse: Awaited<ReturnType<typeof createTestWarehouse>>

  before(async () => {
    testFarmer = await createTestFarmer()
    testWarehouse = await createTestWarehouse()
  })

  after(async () => {
    await prisma.token.deleteMany({
      where: { farmerId: testFarmer.id },
    })
    await prisma.farmer.deleteMany({ where: { id: testFarmer.id } })
    await prisma.warehouse.deleteMany({ where: { id: testWarehouse.id } })
    await prisma.$disconnect()
  })

  test('Split quantity conservation - parent weight equals sum of children weights', async () => {
    // Create parent with 4000 kg (40 bags * 100 kg)
    const parentToken = await prisma.token.create({
      data: {
        tokenId: `TEST-2026-QPARENT01`,
        commodity: Commodity.MAIZE_WHITE,
        grade: Grade.Grade_A,
        bagCount: 40,
        weightPerBagKg: 100,
        totalWeightKg: 4000,
        status: TokenStatus.active,
        isLocked: false,
        txHash: `TX${Date.now()}QPARENT01`,
        stellarExplorerLink: `https://stellar.expert/explorer/testnet/tx/QPARENT01`,
        farmerId: testFarmer.id,
        warehouseId: testWarehouse.id,
        parentTokenId: null,
      },
    })

    // Create two children: 15 bags (1500 kg) and 25 bags (2500 kg)
    const child1 = await prisma.token.create({
      data: {
        tokenId: `TEST-2026-QCHILD01A`,
        commodity: Commodity.MAIZE_WHITE,
        grade: Grade.Grade_A,
        bagCount: 15,
        weightPerBagKg: 100,
        totalWeightKg: 1500,
        status: TokenStatus.active,
        isLocked: false,
        txHash: `TX${Date.now()}QCHILD01A`,
        stellarExplorerLink: `https://stellar.expert/explorer/testnet/tx/QCHILD01A`,
        farmerId: testFarmer.id,
        warehouseId: testWarehouse.id,
        parentTokenId: parentToken.tokenId,
      },
    })

    const child2 = await prisma.token.create({
      data: {
        tokenId: `TEST-2026-QCHILD01B`,
        commodity: Commodity.MAIZE_WHITE,
        grade: Grade.Grade_A,
        bagCount: 25,
        weightPerBagKg: 100,
        totalWeightKg: 2500,
        status: TokenStatus.active,
        isLocked: false,
        txHash: `TX${Date.now()}QCHILD01B`,
        stellarExplorerLink: `https://stellar.expert/explorer/testnet/tx/QCHILD01B`,
        farmerId: testFarmer.id,
        warehouseId: testWarehouse.id,
        parentTokenId: parentToken.tokenId,
      },
    })

    // Verify quantity conservation
    const childrenWeightSum = child1.totalWeightKg + child2.totalWeightKg
    assert.equal(
      childrenWeightSum,
      parentToken.totalWeightKg,
      'Sum of children weights should equal parent weight'
    )
    assert.equal(childrenWeightSum, 4000, 'Total weight should be conserved at 4000 kg')
  })
})
