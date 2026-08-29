import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { after, before, test } from 'node:test'
import { getTestToken, installTestDatabase, resetTestDatabase } from '../helpers/testDb.js'
import { seedTestFarmer, TEST_FARMER_PIN } from '../helpers/testFarmer.js'

resetTestDatabase()
const database = installTestDatabase()
const { default: app } = await import('../../src/app.js')
const { farmerWalletSigner } = await import('../../src/services/stellar.service.js')
const { sdk } = await import('../../src/services/sdk.js')

const buyerWallet = 'GBUYERTESTWALLET'
let server: Server
let baseUrl: string
let farmerId: string
let tokenId: string
let jwt: string
let signerCalls = 0

const request = (path: string, init: RequestInit = {}) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', ...init.headers },
})

before(async () => {
  const fixture = await seedTestFarmer()
  farmerId = fixture.farmer.id
  tokenId = fixture.token.tokenId

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  resetTestDatabase()
})

test('farmer can log in, inspect history, and transfer a token end to end', async () => {
  const originalSigner = farmerWalletSigner.signAsFarmer
  const originalTransfer = sdk.transfer
  farmerWalletSigner.signAsFarmer = async () => {
    signerCalls += 1
    return 'e2e-farmer-signature'
  }
  sdk.transfer = async ({ tokenId: requestedTokenId, buyerWalletAddress }) => ({
    tokenId: requestedTokenId,
    newOwner: buyerWalletAddress,
    txHash: 'e2e-transfer-tx',
    stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/e2e-transfer-tx',
  })

  try {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '08000000001', pin: TEST_FARMER_PIN }),
    })
    assert.equal(loginResponse.status, 200)
    const loginBody = await loginResponse.json() as { data: { token: string; farmerId: string } }
    jwt = loginBody.data.token
    assert.equal(loginBody.data.farmerId, farmerId)

    const initialTokensResponse = await request(`/api/v1/farmers/${farmerId}/tokens`)
    assert.equal(initialTokensResponse.status, 200)
    const initialTokensBody = await initialTokensResponse.json() as { data: Array<{ token_id: string; status: string }> }
    assert.deepEqual(initialTokensBody.data.map((token) => token.token_id), [tokenId])
    assert.equal(initialTokensBody.data[0]?.status, 'active')

    const historyResponse = await request(`/api/v1/farmers/${farmerId}/history`)
    assert.equal(historyResponse.status, 200)
    const historyBody = await historyResponse.json() as { data: Array<{ type: string; tokenId: string }> }
    assert.equal(historyBody.data.length, 1)
    assert.equal(historyBody.data[0]?.type, 'deposit')
    assert.equal(historyBody.data[0]?.tokenId, tokenId)

    const transferResponse = await request('/api/v1/transfers', {
      method: 'POST',
      body: JSON.stringify({ token_id: tokenId, buyer_wallet_address: buyerWallet }),
    })
    assert.equal(transferResponse.status, 200)
    const transferBody = await transferResponse.json() as { data: { token_id: string; status: string; new_owner: string } }
    assert.equal(transferBody.data.token_id, tokenId)
    assert.equal(transferBody.data.status, 'transferred')
    assert.equal(transferBody.data.new_owner, buyerWallet)
    assert.equal(signerCalls, 1)
    assert.equal(getTestToken(tokenId)?.status, 'transferred')

    const finalTokensResponse = await request(`/api/v1/farmers/${farmerId}/tokens`)
    assert.equal(finalTokensResponse.status, 200)
    const finalTokensBody = await finalTokensResponse.json() as { data: Array<{ token_id: string; status: string }> }
    assert.equal(finalTokensBody.data[0]?.token_id, tokenId)
    assert.equal(finalTokensBody.data[0]?.status, 'transferred')
  } finally {
    farmerWalletSigner.signAsFarmer = originalSigner
    sdk.transfer = originalTransfer
  }
})

void database
