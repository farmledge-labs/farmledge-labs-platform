import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import {
  TEST_FARMER_ID,
  TEST_LENDER_ID,
  TEST_TOKEN_ID,
  generateLenderApiKey,
  registerAndApproveLender,
  seedLenderCollateral,
} from '../helpers/apiKey.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'
process.env.LENDER_API_KEY_SALT = process.env.LENDER_API_KEY_SALT || 'test-salt-key-minimum-32-characters-long'
process.env.PLATFORM_ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || 'test-admin-secret'

let server: Server
let baseUrl: string
let apiKey: string
let app: (typeof import('../../src/app.js'))['default']
let signToken: typeof import('../../src/lib/jwt.js')['signToken']

before(async () => {
  app = (await import('../../src/app.js')).default
  signToken = (await import('../../src/lib/jwt.js')).signToken
  registerAndApproveLender()
  seedLenderCollateral()
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP address')
  baseUrl = `http://127.0.0.1:${address.port}`
  apiKey = await generateLenderApiKey(baseUrl)
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('completes lender collateral search, lock, blocked transfer, unlock, and retry flow', async () => {
  const collateralResponse = await fetch(`${baseUrl}/api/v1/lender/farmers/${TEST_FARMER_ID}/collateral`, {
    headers: { 'X-API-Key': apiKey },
  })
  assert.equal(collateralResponse.status, 200)
  const collateralBody = await collateralResponse.json() as any
  assert.equal(collateralBody.success, true)
  assert.equal(collateralBody.data.estimatedValueNgn, 1_000_000)
  assert.equal(collateralBody.data.price.source, 'placeholder')
  assert.equal(collateralBody.data.price.amountNgnPerKg, 1_000)
  assert.equal(collateralBody.data.tokens[0].estimatedValueNgn, 1_000_000)

  const loanReference = 'E2E-LOAN-001'
  const lockResponse = await fetch(`${baseUrl}/api/v1/lender/tokens/${TEST_TOKEN_ID}/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: TEST_LENDER_ID, loan_reference: loanReference }),
  })
  assert.equal(lockResponse.status, 200)
  const lockBody = await lockResponse.json() as any
  assert.equal(lockBody.data.is_locked, true)
  assert.equal(lockBody.data.loan_reference, loanReference)
  assert.equal(lockBody.data.locked_by_lender_id, TEST_LENDER_ID)

  const farmerJwt = signToken({ sub: TEST_FARMER_ID, role: 'farmer' })
  const blockedTransfer = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${farmerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: TEST_TOKEN_ID, buyer_wallet_address: 'GBUYER-E2E-001' }),
  })
  assert.equal(blockedTransfer.status, 400)
  const blockedBody = await blockedTransfer.json() as any
  assert.match(blockedBody.error, /locked/i)

  const unlockResponse = await fetch(`${baseUrl}/api/v1/lender/tokens/${TEST_TOKEN_ID}/unlock`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: TEST_LENDER_ID, loan_reference: loanReference }),
  })
  assert.equal(unlockResponse.status, 200)
  const unlockBody = await unlockResponse.json() as any
  assert.equal(unlockBody.data.is_locked, false)

  const transferAfterUnlock = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${farmerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: TEST_TOKEN_ID, buyer_wallet_address: 'GBUYER-E2E-001' }),
  })
  assert.equal(transferAfterUnlock.status, 200)
})