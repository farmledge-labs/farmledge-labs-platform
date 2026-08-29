import { createHash } from 'node:crypto'
import { seedApiKeyRecord, seedLenderRecord, seedTokenRecord, seedWarehouseRecord } from '../../src/lib/db.js'

const DEFAULT_TEST_SALT = 'test-salt-key-minimum-32-characters-long'

export function hashApiKeyForTests(apiKey: string, salt = process.env.LENDER_API_KEY_SALT ?? DEFAULT_TEST_SALT): string {
  return createHash('sha256').update(`${salt}:${apiKey}`).digest('hex')
}

export async function createTestApiKeyHeader(): Promise<string> {
  const rawApiKey = `test-key-${Math.random().toString(36).slice(2, 10)}`
  const keyHash = hashApiKeyForTests(rawApiKey)

  seedApiKeyRecord({
    lenderId: 'test-lender-id',
    keyHash,
    label: 'test-key',
  })

  return rawApiKey
}

export const TEST_LENDER_ID = 'test-lender-id'
export const TEST_FARMER_ID = 'test-farmer-id'
export const TEST_WAREHOUSE_ID = 'test-warehouse-id'
export const TEST_TOKEN_ID = 'KN-2026-E2E-001'

export function registerAndApproveLender(): void {
  seedLenderRecord({
    id: TEST_LENDER_ID,
    companyName: 'E2E Lender',
    contactEmail: 'e2e-lender@example.com',
    approved: true,
  })
}

export function seedLenderCollateral(): void {
  seedWarehouseRecord({
    id: TEST_WAREHOUSE_ID,
    name: 'E2E Warehouse',
    location: 'Kano',
    state: 'Kano',
    certified: true,
    capacityTonnes: 1000,
    custodianWallet: 'GE2E-CUSTODIAN-001',
  })
  seedTokenRecord({
    id: 'e2e-token-record-001',
    tokenId: TEST_TOKEN_ID,
    commodity: 'MAIZE_WHITE',
    grade: 'Grade_A',
    bagCount: 100,
    weightPerBagKg: 10,
    totalWeightKg: 1000,
    status: 'active',
    isLocked: false,
    lockedByLenderId: null,
    loanReference: null,
    txHash: 'e2e-token-tx-001',
    stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/e2e-token-tx-001',
    farmerId: TEST_FARMER_ID,
    warehouseId: TEST_WAREHOUSE_ID,
  })
}

export async function generateLenderApiKey(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/admin/lenders/${TEST_LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': process.env.PLATFORM_ADMIN_SECRET ?? 'test-admin-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'e2e-lender-key' }),
  })
  if (!response.ok) throw new Error(`Failed to generate lender API key: ${response.status} ${await response.text()}`)
  const body = await response.json() as { data?: { apiKey?: string } }
  if (!body.data?.apiKey) throw new Error('Lender API key was missing from the response')
  return body.data.apiKey
}
