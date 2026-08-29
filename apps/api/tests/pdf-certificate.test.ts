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

test('GET /api/v1/certificates/:token_id returns a PDF warehouse receipt', async () => {
  const res = await fetch(`${baseUrl}/api/v1/certificates/KN-2026-000042`, {
    headers: { Authorization: `Bearer ${validToken}` },
  })

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /application\/pdf/)

  const buffer = Buffer.from(await res.arrayBuffer())
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(buffer.length > 100)
})
