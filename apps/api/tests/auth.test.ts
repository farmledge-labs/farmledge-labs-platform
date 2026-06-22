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

// Custodian routes
test('POST /api/v1/deposits returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, { method: 'POST' })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/deposits returns 200 with auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
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
    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'KN-2026-000001', buyer_wallet_address: 'GABC...' }),
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
