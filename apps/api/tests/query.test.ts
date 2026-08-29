/**
 * tests/query.test.ts
 *
 * Integration tests for GET /api/v1/tokens/:id/onchain — the read-only
 * "query binding" (SDK-9). This endpoint performs a *simulated* on-chain
 * read: no keypair, no signed transaction, no ledger mutation.
 *
 * Strategy: the db proxy in src/lib/db.ts reads from `globalThis.prisma`.
 * We inject a fake Prisma client into globalThis BEFORE importing the app so
 * `db.token.findFirst` returns a controlled fixture. The fake returns the DB
 * token only for its tokenId; every other id resolves to `null`, exercising
 * the no-DB fallback path in the same process.
 *
 * Two suites:
 *  1. No-DB path — findFirst returns null, so the route falls through to the
 *     SDK simulated query and returns a deterministic on-chain view.
 *  2. DB-found path — findFirst returns the fixture, so the simulated state
 *     reflects the DB record (owner, weight, status, is_locked).
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { signToken } from '../src/lib/jwt.js'

const validToken = signToken({ sub: 'test-user', role: 'farmer' })

const DB_TOKEN = {
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
  warehouseId: 'warehouse-001',
  parentTokenId: null,
  depositDate: new Date(),
  exitDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  warehouse: { custodianWallet: 'GCUSTODIANWALLET0001' },
}

// ── Inject fake Prisma client BEFORE importing the app ────────────────────────

const gForPrisma = globalThis as unknown as { prisma: unknown }
gForPrisma.prisma = {
  token: {
    findFirst: async ({ where }: any) => {
      const clauses = where?.OR ?? []
      const matches = clauses.some(
        (c: any) => c.id === DB_TOKEN.tokenId || c.tokenId === DB_TOKEN.tokenId
      )
      return matches ? DB_TOKEN : null
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

// ── Suite 1: No-DB path (falls through to SDK simulated query) ────────────────

describe('GET /api/v1/tokens/:id/onchain — simulated read (no DB record)', () => {
  test('returns 200 with a simulated on-chain view when token is not in DB', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/onchain`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.equal(body.success, true)
    assert.equal(body.data.token_id, 'KN-2026-000001')
    assert.equal(body.data.simulated, true)
    assert.equal(typeof body.data.ledger, 'number')
    assert.ok(body.data.ledger > 0, 'ledger sequence should be present')

    // A read-only simulation is idempotent: same token → same ledger.
    const res2 = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/onchain`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const body2 = (await res2.json()) as any
    assert.equal(body2.data.ledger, body.data.ledger)
  })

  test('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/onchain`)
    assert.equal(res.status, 401)
  })
})

// ── Suite 2: DB-found path — simulated state reflects the DB record ───────────

describe('GET /api/v1/tokens/:id/onchain — reflects DB token', () => {
  test('returns 200 with simulated state derived from the DB token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000042/onchain`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })

    assert.equal(res.status, 200)
    const body = (await res.json()) as any
    assert.equal(body.success, true)
    assert.equal(body.data.token_id, 'KN-2026-000042')
    assert.equal(body.data.owner, 'GCUSTODIANWALLET0001')
    assert.equal(body.data.total_weight_kg, 4000)
    assert.equal(body.data.status, 'active')
    assert.equal(body.data.is_locked, false)
    assert.equal(body.data.simulated, true)
    assert.equal(typeof body.data.ledger, 'number')
  })
})
