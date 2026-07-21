import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import app from '../src/app.js'
import { signToken } from '../src/lib/jwt.js'

let server: Server
let baseUrl: string
const validToken = signToken({ sub: 'test-user', role: 'farmer' })

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

test('test_transfer_schema_valid — valid body passes through to stub handler', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'KN-2026-000001', buyer_wallet_address: 'GABC...' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — createTransfer' })
})

test('test_transfer_schema_invalid — missing field returns 400 with readable error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'KN-2026-000001' }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /buyer_wallet_address is required/)
})

test('test_lock_schema_valid — valid body passes through to stub handler', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: 'lender-1', loan_reference: 'LOAN-001' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — POST /api/v1/lender/tokens/:token_id/lock' })
})

test('test_lock_schema_invalid — missing field returns 400 with readable error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: 'lender-1' }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /loan_reference is required/)
})

test('test_split_schema_valid — valid split request body passes validation', async () => {
  const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/split`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ split_amount_kg: 1500 }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.parent_token_id, 'KN-2026-000001')
  assert.equal(body.data.children.length, 2)
  assert.equal(body.data.children[0].total_weight_kg, 1500)
  assert.equal(body.data.children[1].total_weight_kg, 2500)
})

test('test_split_schema_invalid — missing split_amount_kg returns 400 with error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/split`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /split_amount_kg is required/)
})

test('test_split_schema_invalid — negative split_amount_kg returns 400 with error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000001/split`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ split_amount_kg: -500 }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.match(body.error, /split_amount_kg must be greater than 0/)
})

