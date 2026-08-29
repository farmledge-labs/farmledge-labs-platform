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

test('POST /api/v1/uploads/presign returns 401 without auth header', async () => {
  const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'test.jpg', contentType: 'image/jpeg' }),
  })
  assert.equal(res.status, 401)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

test('POST /api/v1/uploads/presign returns 400 when fileName is missing', async () => {
  const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contentType: 'image/jpeg' }),
  })
  assert.equal(res.status, 400)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.ok(typeof body.error === 'string' && body.error.includes('fileName'))
})

test('POST /api/v1/uploads/presign returns 400 when contentType is missing', async () => {
  const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: 'test.jpg' }),
  })
  assert.equal(res.status, 400)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.ok(typeof body.error === 'string' && body.error.includes('contentType'))
})

test('POST /api/v1/uploads/presign returns 400 for unsupported contentType', async () => {
  const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: 'test.exe', contentType: 'application/x-msdownload' }),
  })
  assert.equal(res.status, 400)
  const body = (await res.json()) as { success?: unknown; error?: unknown }
  assert.equal(body.success, false)
  assert.ok(typeof body.error === 'string' && body.error.includes('contentType'))
})

test('POST /api/v1/uploads/presign returns 200 with url and key for valid request', async () => {
  const res = await fetch(`${baseUrl}/api/v1/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: 'certificate.pdf', contentType: 'application/pdf' }),
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    success?: unknown
    data?: { url?: unknown; key?: unknown }
  }
  assert.equal(body.success, true)
  assert.ok(body.data, 'response should contain data')
  assert.ok(typeof body.data?.url === 'string' && body.data.url.length > 0, 'url should be a non-empty string')
  assert.ok(typeof body.data?.key === 'string' && body.data.key.length > 0, 'key should be a non-empty string')
  assert.ok((body.data?.key as string).endsWith('certificate.pdf'), 'key should end with the original fileName')
  assert.ok((body.data?.key as string).startsWith('uploads/'), 'key should start with uploads/')
})
