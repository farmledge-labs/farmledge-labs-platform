/**
 * tests/transfers.test.ts
 *
 * Integration tests for POST /api/v1/transfers.
 *
 * Two test suites:
 *  1. Success case — no DB token found (no-DB path), SDK is called and
 *     returns { token_id, status: 'transferred', new_owner, tx_hash, ... }.
 *  2. Locked-token rejection — db.token.findFirst returns a locked token;
 *     the route must return 400 without calling the SDK.
 *
 * Strategy for the locked-token suite: inject a fake Prisma client into
 * globalThis.prisma before importing the app so that db.token.findFirst
 * returns a controlled fixture (same pattern as login.test.ts).
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { signToken } from '../src/lib/jwt.js'

const validToken = signToken({ sub: 'test-user', role: 'farmer' })

// ─── Suite 1: Success path (no DB record — falls through to SDK stub) ─────────

describe('POST /api/v1/transfers — success (no DB record)', () => {
  // Import app fresh — no DB injection needed; db.token.findFirst returns null
  // by default in the proxy fallback when clientInstance is null.
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
  })

  test('returns 200 with SDK transfer result when token is not in DB', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token_id: 'KN-2026-000001',
        buyer_wallet_address: 'GABC1234567890BUYER',
      }),
    })

    assert.equal(res.status, 200)
    const body = await res.json() as any
    assert.equal(body.success, true)
    assert.equal(body.data.token_id, 'KN-2026-000001')
    assert.equal(body.data.status, 'transferred')
    assert.equal(body.data.new_owner, 'GABC1234567890BUYER')
    assert.ok(typeof body.data.tx_hash === 'string' && body.data.tx_hash.length > 0, 'tx_hash should be present')
    assert.ok(typeof body.data.stellar_explorer_link === 'string' && body.data.stellar_explorer_link.startsWith('https://'), 'stellar_explorer_link should be a URL')
  })

  test('returns 400 when buyer_wallet_address is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token_id: 'KN-2026-000001' }),
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.success, false)
    assert.match(body.error, /buyer_wallet_address is required/)
  })

  test('returns 400 when token_id is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ buyer_wallet_address: 'GABC1234567890BUYER' }),
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.success, false)
    assert.match(body.error, /token_id is required/)
  })

  test('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_id: 'KN-2026-000001',
        buyer_wallet_address: 'GABC1234567890BUYER',
      }),
    })

    assert.equal(res.status, 401)
  })
})

// ─── Suite 2: Locked-token rejection ─────────────────────────────────────────
//
// Inject a fake Prisma client into globalThis.prisma that returns a locked
// token fixture from db.token.findFirst.  This must happen before importing
// the app so the db proxy picks up the fake client.

describe('POST /api/v1/transfers — locked-token rejection', () => {
  const LOCKED_TOKEN = {
    id: 'token-uuid-locked-001',
    tokenId: 'KN-2026-LOCKED',
    commodity: 'MAIZE_WHITE',
    grade: 'Grade_A',
    bagCount: 40,
    weightPerBagKg: 100,
    totalWeightKg: 4000,
    status: 'active',
    isLocked: true,                // ← locked
    lockedByLenderId: 'lender-1',
    loanReference: 'LOAN-001',
    txHash: 'abc123locked',
    stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/abc123locked',
    farmerId: 'farmer-001',
    warehouseId: 'warehouse-001',
    parentTokenId: null,
    depositDate: new Date(),
    exitDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Patch globalThis BEFORE dynamic import so db proxy picks it up
  const gForPrisma = globalThis as unknown as { prisma: unknown }
  gForPrisma.prisma = {
    token: {
      findFirst: async () => LOCKED_TOKEN,
      update: async (args: any) => ({ ...LOCKED_TOKEN, ...args?.data }),
    },
    $transaction: async (promisesOrFn: any) => {
      if (Array.isArray(promisesOrFn)) return await Promise.all(promisesOrFn)
      return await promisesOrFn(gForPrisma.prisma)
    },
  }

  // Dynamic import after patching so the module sees the fake prisma
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
    // Restore globalThis so subsequent test files start clean
    delete (gForPrisma as any).prisma
  })

  test('returns 400 when the token is locked', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token_id: 'KN-2026-LOCKED',
        buyer_wallet_address: 'GABC1234567890BUYER',
      }),
    })

    assert.equal(res.status, 400)
    const body = await res.json() as any
    assert.equal(body.success, false)
    assert.match(body.error, /locked/)
  })
})
