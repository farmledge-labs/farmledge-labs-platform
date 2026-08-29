import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'
process.env.LENDER_API_KEY_SALT = 'test-salt-key-minimum-32-characters-long'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
process.env.STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet'
process.env.HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
process.env.PLATFORM_ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || 'test-admin-secret'
process.env.S3_BUCKET = process.env.S3_BUCKET || 'test-bucket'
process.env.S3_REGION = process.env.S3_REGION || 'test-region'

const rawApiKey = 'unlock-test-api-key'
const token = {
  id: 'token-unlock-001',
  tokenId: 'KN-2026-UNLOCK-001',
  status: 'active',
  isLocked: true,
  lockedByLenderId: 'lender-1',
  loanReference: 'LOAN-001',
}

const gForPrisma = globalThis as unknown as { prisma: unknown }
let currentToken = { ...token }
gForPrisma.prisma = {
  apiKey: {
    findFirst: async () => ({ id: 'api-key-1', revokedAt: null }),
    update: async () => undefined,
  },
  token: {
    findFirst: async () => ({ ...currentToken }),
    update: async ({ data }: { data: Partial<typeof token> }) => {
      currentToken = { ...currentToken, ...data }
      return { ...currentToken }
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
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP address')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  delete gForPrisma.prisma
})

test('unlocks a token when the repayment identifies its lock', async () => {
  const response = await fetch(`${baseUrl}/api/v1/lender/tokens/${token.tokenId}/unlock`, {
    method: 'POST',
    headers: { 'X-API-Key': rawApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: 'lender-1', loan_reference: 'LOAN-001' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.success, true)
  assert.equal(body.data.token_id, token.tokenId)
  assert.equal(body.data.is_locked, false)
  assert.equal(body.data.locked_by_lender_id, null)
  assert.equal(body.data.loan_reference, null)
})

test('rejects a repayment for a different lender or loan', async () => {
  currentToken = { ...token }
  const response = await fetch(`${baseUrl}/api/v1/lender/tokens/${token.tokenId}/unlock`, {
    method: 'POST',
    headers: { 'X-API-Key': rawApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: 'lender-2', loan_reference: 'LOAN-002' }),
  })

  assert.equal(response.status, 403)
  const body = await response.json() as any
  assert.equal(body.success, false)
  assert.match(body.error, /does not belong/)
  assert.equal(currentToken.isLocked, true)
})

test('requires lender and loan identifiers', async () => {
  const response = await fetch(`${baseUrl}/api/v1/lender/tokens/${token.tokenId}/unlock`, {
    method: 'POST',
    headers: { 'X-API-Key': rawApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  assert.equal(response.status, 400)
  const body = await response.json() as any
  assert.match(body.error, /lender_id is required/)
  assert.match(body.error, /loan_reference is required/)
})
