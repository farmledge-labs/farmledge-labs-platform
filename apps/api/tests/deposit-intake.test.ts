import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import app from '../src/app.js'
import { signToken } from '../src/lib/jwt.js'
import { BAG_SIZE_CONFIG } from '../src/config/bagSizes.js'
import { db } from '../src/lib/db.js'

let server: Server
let baseUrl: string
const validToken = signToken({ sub: 'test-custodian', role: 'custodian' })

const baseDeposit = {
  farmerId: 'farmer-1',
  commodity: 'MAIZE_WHITE',
  grade: 'Grade A',
  bagCount: 10,
  weightPerBagKg: 95,
  warehouseId: 'warehouse-1',
}

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

test('deposit intake — actualWeighedKg, when present, is used as total_weight_kg', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseDeposit, actualWeighedKg: 987.5 }),
  })
  assert.equal(res.status, 201)
  const body = (await res.json()) as any
  assert.equal(body.success, true)
  assert.equal(body.data.total_weight_kg, 987.5)
})

test('deposit intake — without actualWeighedKg, total_weight_kg derives from bagCount * standard bag size', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(baseDeposit),
  })
  assert.equal(res.status, 201)
  const body = (await res.json()) as any
  assert.equal(body.success, true)
  const expected = baseDeposit.bagCount * BAG_SIZE_CONFIG.MAIZE_WHITE.standardKg
  assert.equal(body.data.total_weight_kg, expected)
})

test('deposit intake — rejects non-positive actualWeighedKg', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...baseDeposit, actualWeighedKg: -5 }),
  })
  assert.equal(res.status, 400)
  const body = (await res.json()) as any
  assert.equal(body.success, false)
})

test('deposit intake — writes an audit log for the authenticated mutation', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(baseDeposit),
  })
  assert.equal(res.status, 201)

  const auditLogs = await db.auditLog.findMany()
  assert.ok(auditLogs.some((log) => (
    log.actorId === 'test-custodian' &&
    log.actorRole === 'custodian' &&
    log.action === 'POST /api/v1/deposits'
  )))
})
