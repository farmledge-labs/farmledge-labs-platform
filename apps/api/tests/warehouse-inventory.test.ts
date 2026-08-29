/**
 * tests/warehouse-inventory.test.ts
 *
 * Integration tests for GET /api/v1/warehouse/:warehouse_id/inventory (CUST-3).
 * The controller runs a real Prisma query filtered by `warehouseId` and
 * serializes each row into the snake_case `TokenRecord` shape.
 *
 * Strategy: the db proxy in src/lib/db.ts reads from `globalThis.prisma`.
 * We inject a fake Prisma client BEFORE importing the app so that
 * `db.token.findMany` returns a controlled fixture. The fake returns the two
 * fixture tokens only for their warehouse; every other warehouse resolves to
 * an empty array, exercising the empty-warehouse path in the same process.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { signToken } from '../src/lib/jwt.js'

const validToken = signToken({ sub: 'test-custodian', role: 'custodian' })

const WAREHOUSE_ID = 'warehouse-001'

const DB_TOKENS = [
  {
    id: 'token-uuid-001',
    tokenId: 'KN-2026-000042',
    commodity: 'MAIZE_WHITE',
    grade: 'Grade_A',
    bagCount: 40,
    weightPerBagKg: 100,
    totalWeightKg: 4000,
    status: 'active',
    isLocked: false,
    lockedByLenderId: null,
    loanReference: null,
    txHash: 'abc123',
    stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/abc123',
    farmerId: 'farmer-001',
    warehouseId: WAREHOUSE_ID,
    parentTokenId: null,
    depositDate: new Date('2026-03-14T00:00:00.000Z'),
    exitDate: null,
    createdAt: new Date('2026-03-14T00:00:00.000Z'),
    updatedAt: new Date('2026-03-14T00:00:00.000Z'),
    warehouse: { name: 'Kano Central', certified: true, custodianWallet: 'GCUSTODIANWALLET0001' },
  },
  {
    id: 'token-uuid-002',
    tokenId: 'KN-2026-000043',
    commodity: 'SESAME',
    grade: 'Grade_B',
    bagCount: 20,
    weightPerBagKg: 50,
    totalWeightKg: 1000,
    status: 'active',
    isLocked: false,
    lockedByLenderId: null,
    loanReference: null,
    txHash: 'def456',
    stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/def456',
    farmerId: 'farmer-002',
    warehouseId: WAREHOUSE_ID,
    parentTokenId: null,
    depositDate: new Date('2026-03-10T00:00:00.000Z'),
    exitDate: null,
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
    updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    warehouse: { name: 'Kano Central', certified: true, custodianWallet: 'GCUSTODIANWALLET0001' },
  },
]

// ── Inject fake Prisma client BEFORE importing the app ────────────────────────

const gForPrisma = globalThis as unknown as { prisma: unknown }
gForPrisma.prisma = {
  token: {
    findMany: async ({ where }: any) => {
      return where?.warehouseId === WAREHOUSE_ID ? DB_TOKENS : []
    },
    count: async ({ where }: any) => {
      return where?.warehouseId === WAREHOUSE_ID ? DB_TOKENS.length : 0
    },
  },
}

const { default: app } = await import('../src/app.js')

let server: Server
let baseUrl: string

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('Expected TCP address')
  baseUrl = `http://127.0.0.1:${addr.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  delete (gForPrisma as any).prisma
})

describe('GET /api/v1/warehouse/:warehouse_id/inventory', () => {
  test('returns the warehouse tokens serialized to snake_case', async () => {
    const res = await fetch(`${baseUrl}/api/v1/warehouse/${WAREHOUSE_ID}/inventory`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data))
    assert.equal(body.data.length, 2)

    const [first] = body.data
    assert.equal(first.token_id, 'KN-2026-000042')
    assert.equal(first.warehouse_id, WAREHOUSE_ID)
    assert.equal(first.warehouse_name, 'Kano Central')
    assert.equal(first.warehouse_certified, true)
    assert.equal(first.custodian_wallet, 'GCUSTODIANWALLET0001')
    assert.equal(first.total_weight_kg, 4000)
    assert.equal(first.deposit_date, '2026-03-14T00:00:00.000Z')

    // Every returned token belongs to the requested warehouse.
    assert.ok(body.data.every((t: any) => t.warehouse_id === WAREHOUSE_ID))
    assert.deepEqual(body.pagination, {
  limit: 20,
  next_cursor: null,
  has_more: false,
   })
  })

  test('returns an empty array for a warehouse with no tokens', async () => {
    const res = await fetch(`${baseUrl}/api/v1/warehouse/empty-warehouse/inventory`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })

    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.success, true)
    assert.deepEqual(body.data, [])
    assert.deepEqual(body.pagination, {
  limit: 20,
  next_cursor: null,
  has_more: false,
   })
  })

  test('rejects requests without a JWT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/warehouse/${WAREHOUSE_ID}/inventory`)
    assert.equal(res.status, 401)
  })
})
