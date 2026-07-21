import { test, before, after, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import app from '../src/app.js'
import * as stellarService from '../src/services/stellar.service.js'
import * as db from '../src/db/index.js'

let server: Server
let baseUrl: string

const MOCK_TX_HASH = 'abc'

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
  mock.reset()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

// Custodian routes
describe('POST /api/v1/deposits', () => {
  const depositPayload = {
    farmerId: 'FARMER-123',
    commodity: 'MAIZE_WHITE',
    grade: 'Grade A',
    bagCount: 100,
    weightPerBagKg: 50,
    warehouseId: 'WH-456',
  }

  before(() => {
    // Clear the mock DB before each run
    db._clearTokens()
  })

  test('returns 401 without auth header', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deposits`, { method: 'POST' })
    assert.equal(res.status, 401)
    const body = (await res.json()) as { success?: unknown; error?: unknown }
    assert.equal(body.success, false)
    assert.equal(body.error, 'Unauthorized')
  })

  test('returns 201 and creates a token on success', async () => {
    mock.method(stellarService, 'mint', async () => ({ txHash: MOCK_TX_HASH, tokenId: 'xyz' }))

    const res = await fetch(`${baseUrl}/api/v1/deposits`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(depositPayload),
    })
    assert.equal(res.status, 201)
    const body = (await res.json()) as { success?: unknown; data?: any }
    assert.equal(body.success, true)
    assert.equal(body.data.tx_hash, MOCK_TX_HASH)
    assert.equal(body.data.total_weight_kg, 5000)
  })

  test('returns 200 and existing token if txHash is a duplicate', async () => {
    // The previous test already created a token with MOCK_TX_HASH
    mock.method(stellarService, 'mint', async () => ({ txHash: MOCK_TX_HASH, tokenId: 'xyz' }))

    const res = await fetch(`${baseUrl}/api/v1/deposits`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(depositPayload),
    })
    assert.equal(res.status, 200) // Idempotent call returns 200 OK
    const body = (await res.json()) as { success?: unknown; data?: any }
    assert.equal(body.data.tx_hash, MOCK_TX_HASH)
  })

  test('returns 500 if stellarService.mint fails', async () => {
    mock.method(stellarService, 'mint', async () => Promise.reject(new Error('Stellar network error')))
    const res = await fetch(`${baseUrl}/api/v1/deposits`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(depositPayload),
    })
    assert.equal(res.status, 500)
  })
})

test('POST /api/v1/exits/:token_id returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/exits/123`, { method: 'POST' })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/exits/:token_id returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/exits/123`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('GET /api/v1/warehouse/:warehouse_id/inventory returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/warehouse/123/inventory`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('GET /api/v1/warehouse/:warehouse_id/inventory returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/warehouse/123/inventory`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

// Farmer routes
test('GET /api/v1/farmers/:farmer_id/tokens returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/123/tokens`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('GET /api/v1/farmers/:farmer_id/tokens returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/123/tokens`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('GET /api/v1/farmers/:farmer_id/history returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/123/history`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('GET /api/v1/farmers/:farmer_id/history returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/123/history`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('POST /api/v1/transfers returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, { method: 'POST' })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/transfers returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('GET /api/v1/certificates/:token_id returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/certificates/123`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('GET /api/v1/certificates/:token_id returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/certificates/123`, {
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

// Lender routes should remain unaffected
test('GET /api/v1/lender/farmers/:farmer_id/collateral returns 200 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/123/collateral`)
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('GET /api/v1/lender/tokens/:token_id/verify returns 200 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/verify`)
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('POST /api/v1/lender/tokens/:token_id/lock returns 200 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/lock`, { method: 'POST' })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})
