import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import app from '../src/app.js'

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

test('POST /api/v1/deposits returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — createDeposit' })
})

test('POST /api/v1/exits/test-token returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/exits/test-token`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — createExit' })
})

test('GET /api/v1/warehouse/test-warehouse/inventory returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/warehouse/test-warehouse/inventory`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — getWarehouseInventory' })
})

test('GET /api/v1/farmers/test-farmer/tokens returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/test-farmer/tokens`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — getFarmerTokens' })
})

test('GET /api/v1/farmers/test-farmer/history returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/test-farmer/history`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — getFarmerHistory' })
})

test('test_transfer_schema_valid passes valid transfer body through to stub handler', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token_id: 'KN-2026-000001',
      buyer_wallet_address: 'GABC123',
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — createTransfer' })
})

test('test_transfer_schema_invalid returns 400 with readable error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'KN-2026-000001' }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.deepEqual(body, { success: false, error: 'buyer_wallet_address is required' })
})

test('GET /api/v1/certificates/test-token returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/certificates/test-token`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — getCertificate' })
})

test('GET /api/v1/lender/farmers/test-farmer/collateral returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/test-farmer/collateral`, {
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — GET /api/v1/lender/farmers/:farmer_id/collateral' })
})

test('GET /api/v1/lender/tokens/test-token/verify returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/verify`, {
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — GET /api/v1/lender/tokens/:token_id/verify' })
})

test('test_lock_schema_valid passes valid lock body through to stub handler', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lender_id: 'lender-1',
      loan_reference: 'loan-2026-0001',
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: 'STUB — POST /api/v1/lender/tokens/:token_id/lock' })
})

test('test_lock_schema_invalid returns 400 with readable error', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ loan_reference: 'loan-2026-0001' }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.deepEqual(body, { success: false, error: 'lender_id is required' })
})
