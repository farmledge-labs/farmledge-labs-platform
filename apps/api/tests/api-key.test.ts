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

// Negative-path: every lender route must reject requests that omit the
// X-API-Key header. These are the 3 acceptance-criteria tests from #26.
test('GET /api/v1/lender/farmers/:farmer_id/collateral returns 401 without X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/123/collateral`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'API key required')
})

test('GET /api/v1/lender/tokens/:token_id/verify returns 401 without X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/verify`)
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'API key required')
})

test('POST /api/v1/lender/tokens/:token_id/lock returns 401 without X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/lock`, { method: 'POST' })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'API key required')
})

// Positive-path: same routes return 200 when the header is present.
// Confirms the middleware does not over-reach and that the upstream
// JWT pipeline is unaffected by the lender-side change.
test('GET /api/v1/lender/farmers/:farmer_id/collateral returns 200 with X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/123/collateral`, {
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('GET /api/v1/lender/tokens/:token_id/verify returns 200 with X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/verify`, {
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

test('POST /api/v1/lender/tokens/:token_id/lock returns 200 with X-API-Key header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/123/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { success?: unknown }
  assert.equal(body.success, true)
})

// Edge case: an empty X-API-Key value must still be rejected.
test('GET /api/v1/lender/farmers/:farmer_id/collateral returns 401 when X-API-Key is empty', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/123/collateral`, {
    headers: { 'X-API-Key': '' },
  })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'API key required')
})
