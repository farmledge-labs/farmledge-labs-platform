import bcrypt from 'bcrypt'
import {
  seedTestActivity,
  seedTestToken,
  seedTestWarehouse,
  type TestFarmer,
  type TestToken,
} from './testDb.js'

export const TEST_FARMER_PIN = '1234'

export type FarmerFixture = {
  farmer: TestFarmer
  token: TestToken
}

export async function seedTestFarmer(): Promise<FarmerFixture> {
  const now = new Date('2026-08-01T10:00:00.000Z')
  const farmer: TestFarmer = {
    id: 'farmer-e2e-001',
    fullName: 'Amina Yusuf',
    phone: '08000000001',
    pinHash: await bcrypt.hash(TEST_FARMER_PIN, 4),
    stellarWallet: 'GFARMERTESTWALLET',
    bvnVerified: true,
    createdAt: now,
    updatedAt: now,
  }
  const database = (globalThis as unknown as { prisma: { farmer: { create(args: { data: TestFarmer }): Promise<TestFarmer> } } }).prisma
  await database.farmer.create({ data: farmer })

  const warehouse = seedTestWarehouse({ id: 'warehouse-e2e-001' })
  const token = seedTestToken({
    id: 'token-e2e-001',
    tokenId: 'KN-2026-E2E-001',
    farmerId: farmer.id,
    warehouseId: warehouse.id,
    depositDate: now,
  })
  seedTestActivity({
    farmerId: farmer.id,
    tokenId: token.tokenId,
    type: 'deposit',
    createdAt: now,
    metadata: { commodity: token.commodity, totalWeightKg: token.totalWeightKg },
  })

  return { farmer, token }
}
