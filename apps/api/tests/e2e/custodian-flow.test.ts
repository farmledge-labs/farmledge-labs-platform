import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { installTestDb, uninstallTestDb, getTestToken, resetTestDb } from '../helpers/testDb.js'
import { custodianHeaders } from '../helpers/testCustodian.js'

installTestDb()
const { default: app } = await import('../../src/app.js')

let server: Server
let baseUrl: string
const deposit = {
  farmerId: 'farmer-e2e',
  commodity: 'MAIZE_WHITE',
  grade: 'Grade A',
  bagCount: 10,
  weightPerBagKg: 95,
  warehouseId: 'warehouse-e2e',
}

before(async () => {
  resetTestDb()
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP address')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  uninstallTestDb()
})

test('custodian deposit-to-exit flow is persisted and idempotent', async () => {
  const postDeposit = () =>
    fetch(`${baseUrl}/api/v1/deposits`, {
      method: 'POST',
      headers: custodianHeaders(),
      body: JSON.stringify(deposit),
    })

  const first = await postDeposit()
  assert.equal(first.status, 201)
  const firstBody = (await first.json()) as any
  assert.equal(firstBody.data.tx_hash, 'mock-tx-hash')
  assert.equal(getTestToken('mock-token-id')?.txHash, 'mock-tx-hash')

  const retry = await postDeposit()
  assert.equal(retry.status, 200)
  const retryBody = (await retry.json()) as any
  assert.equal(retryBody.data.token_id, 'mock-token-id')

  const inventory = await fetch(`${baseUrl}/api/v1/warehouse/warehouse-e2e/inventory`, {
    headers: custodianHeaders(),
  })
  assert.equal(inventory.status, 200)
  assert.deepEqual((await inventory.json()).data.map((token: any) => token.token_id), ['mock-token-id'])

  const exit = await fetch(`${baseUrl}/api/v1/exits/mock-token-id`, {
    method: 'POST',
    headers: custodianHeaders(),
    body: JSON.stringify({ exit_reason: 'sold', delivery_note_number: 'DN-E2E-001' }),
  })
  assert.equal(exit.status, 200)
  assert.equal((await exit.json()).data.status, 'exited')
  assert.equal(getTestToken('mock-token-id')?.status, 'exited')

  const afterExit = await fetch(`${baseUrl}/api/v1/warehouse/warehouse-e2e/inventory`, {
    headers: custodianHeaders(),
  })
  assert.deepEqual((await afterExit.json()).data, [])
})