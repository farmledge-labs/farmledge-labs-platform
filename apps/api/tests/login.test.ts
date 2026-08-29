/**
 * tests/login.test.ts
 *
 * Integration tests for POST /api/v1/auth/login.
 *
 * Strategy: the db proxy in src/lib/db.ts reads from `globalThis.prisma`.
 * We inject a fake Prisma client into globalThis before importing the app so
 * all calls to `db.farmer.*` go to our in-memory stub instead of a real DB.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import bcrypt from 'bcrypt'

// ── Test fixture ──────────────────────────────────────────────────────────────

const VALID_PIN = '1234'
const pinHash = await bcrypt.hash(VALID_PIN, 10)

const FARMER_STUB = {
  id: 'farmer-uuid-test-001',
  fullName: 'Aminu Musa',
  phone: '08012345678',
  pinHash,
  stellarWallet: 'GABC123',
  bvnVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ── Inject fake Prisma client BEFORE importing the app ────────────────────────

const gForPrisma = globalThis as unknown as { prisma: unknown }
gForPrisma.prisma = {
  farmer: {
    findUnique: async ({ where }: { where: { phone?: string } }) => {
      if (where.phone === FARMER_STUB.phone) return FARMER_STUB
      return null
    },
  },
}

// ── Import app AFTER patching globalThis ─────────────────────────────────────

// Dynamic import so the module initialises after our patch above.
const { default: app } = await import('../src/app.js')

// ── Server lifecycle ──────────────────────────────────────────────────────────

let server: Server
let baseUrl: string

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const addr = server.address()
  if (addr === null || typeof addr === 'string') {
    throw new Error('Expected a TCP address from app.listen(0)')
  }
  baseUrl = `http://127.0.0.1:${addr.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const post = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// ── Tests ─────────────────────────────────────────────────────────────────────

test('POST /api/v1/auth/login — valid phone + correct PIN returns 200 with token', async () => {
  const res = await post('/api/v1/auth/login', {
    phone: FARMER_STUB.phone,
    pin: VALID_PIN,
  })

  assert.equal(res.status, 200)

  const body = (await res.json()) as {
    success?: boolean
    data?: { token?: string; farmerId?: string }
  }

  assert.equal(body.success, true)
  assert.ok(body.data?.token, 'response should include a JWT token')
  assert.equal(body.data?.farmerId, FARMER_STUB.id)

  // JWT should be three dot-separated base64url segments
  const parts = body.data!.token!.split('.')
  assert.equal(parts.length, 3, 'token should be a valid JWT (3 segments)')
})

test('POST /api/v1/auth/login — correct phone but wrong PIN returns 401', async () => {
  const res = await post('/api/v1/auth/login', {
    phone: FARMER_STUB.phone,
    pin: '9999',
  })

  assert.equal(res.status, 401)

  const body = (await res.json()) as { success?: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/auth/login — unknown phone returns 401', async () => {
  const res = await post('/api/v1/auth/login', {
    phone: '00000000000',
    pin: VALID_PIN,
  })

  assert.equal(res.status, 401)

  const body = (await res.json()) as { success?: boolean; error?: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/auth/login — missing PIN returns 400', async () => {
  const res = await post('/api/v1/auth/login', { phone: FARMER_STUB.phone })

  assert.equal(res.status, 400)

  const body = (await res.json()) as { success?: boolean; error?: string }
  assert.equal(body.success, false)
  assert.ok(body.error, 'should return a validation error message')
})

test('POST /api/v1/auth/login — non-numeric PIN returns 400', async () => {
  const res = await post('/api/v1/auth/login', {
    phone: FARMER_STUB.phone,
    pin: 'abcd',
  })

  assert.equal(res.status, 400)

  const body = (await res.json()) as { success?: boolean }
  assert.equal(body.success, false)
})

test('POST /api/v1/auth/login — PIN shorter than 4 digits returns 400', async () => {
  const res = await post('/api/v1/auth/login', {
    phone: FARMER_STUB.phone,
    pin: '123',
  })

  assert.equal(res.status, 400)

  const body = (await res.json()) as { success?: boolean }
  assert.equal(body.success, false)
})
