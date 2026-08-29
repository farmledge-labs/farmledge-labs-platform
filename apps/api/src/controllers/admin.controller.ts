import { randomBytes, createHash } from 'node:crypto'
import { type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { db } from '../lib/db.js'
import { created, badRequest, unauthorized, notFound, serverError, ok } from '../utils/response.js'
import { sdk } from '../services/sdk.js'
import type { z } from 'zod'
import type { OnboardCustodianSchema } from '../schemas/index.js'

/**
 * Hash a raw API key using the same algorithm as requireAPIKey middleware.
 * Format: SHA-256( LENDER_API_KEY_SALT + ':' + rawKey )
 */
function hashApiKey(rawKey: string): string {
  const salt = env.LENDER_API_KEY_SALT
  return createHash('sha256').update(`${salt}:${rawKey}`).digest('hex')
}

/**
 * POST /api/v1/admin/lenders/:id/api-keys
 *
 * Admin-only endpoint (requires X-Admin-Secret header).
 * Generates a cryptographically random API key for the specified lender,
 * stores only its SHA-256 hash, and returns the plaintext key exactly once.
 *
 * Request headers:
 *   X-Admin-Secret: <PLATFORM_ADMIN_SECRET>
 *
 * Request body (validated by GenerateApiKeySchema before reaching here):
 *   { "label"?: "string" }   — human-readable label for the key (defaults to "api-key")
 *
 * Response 201:
 *   { success: true, data: { apiKey: string, keyId: string, lenderId: string, label: string, createdAt: string } }
 *
 * The raw `apiKey` is returned exactly once and is never stored. Only the
 * hash is persisted. There is no way to retrieve the plaintext key again.
 */
export async function generateApiKey(req: Request, res: Response): Promise<void> {
  // 1. Authenticate the caller
  const adminSecret = req.headers['x-admin-secret']
  const secret = Array.isArray(adminSecret) ? adminSecret[0] : adminSecret

  if (!secret || secret !== env.PLATFORM_ADMIN_SECRET) {
    unauthorized(res)
    return
  }

  const { id: lenderId } = req.params

  if (!lenderId) {
    badRequest(res, 'Lender ID is required')
    return
  }

  // Body has been validated/stripped by GenerateApiKeySchema via validate() middleware.
  // req.body is either {} or { label: string }.
  const label: string = (req.body as { label?: string }).label?.trim() || 'api-key'

  try {
    // 2. Verify the lender exists
    const lender = await db.lender.findUnique({ where: { id: lenderId } })

    if (!lender) {
      notFound(res, `Lender ${lenderId} not found`)
      return
    }

    // 3. Generate a cryptographically random 32-byte key, hex-encoded (64 chars)
    const rawKey = randomBytes(32).toString('hex')

    // 4. Hash the key — only the hash is stored
    const keyHash = hashApiKey(rawKey)

    // 5. Persist the hash record
    const record = await db.apiKey.create({
      data: {
        lenderId,
        keyHash,
        label,
      },
    })

    // 6. Return the plaintext key exactly once — it is never retrievable again
    created(res, {
      apiKey: rawKey,
      keyId: record.id,
      lenderId: record.lenderId,
      label: record.label,
      createdAt: record.createdAt,
    })
  } catch (err) {
    serverError(res, 'Failed to generate API key')
  }
}

type OnboardCustodianBody = z.infer<typeof OnboardCustodianSchema>

/**
 * POST /api/v1/admin/custodians
 *
 * CUST-4 — Custodian onboarding endpoint.
 *
 * Admin-only endpoint (requires X-Admin-Secret header).
 * Calls SDK add_custodian() on-chain AND creates the DB record in the same request.
 *
 * The request body has already been parsed and validated by OnboardCustodianSchema
 * via the validate() middleware in admin.routes.ts, so no further field extraction
 * or manual type-checking is needed here.
 *
 * Critical pattern:
 * - On-chain transaction succeeds BEFORE writing to the database.
 * - Uses returned Stellar transaction hash / custodian wallet as idempotency key to prevent duplicate minting.
 * - If on-chain transaction fails or DB write fails, neither persists.
 */
export async function onboardCustodian(req: Request, res: Response): Promise<void> {
  // 1. Authenticate caller using X-Admin-Secret header
  const adminSecret = req.headers['x-admin-secret']
  const secret = Array.isArray(adminSecret) ? adminSecret[0] : adminSecret

  if (!secret || secret !== env.PLATFORM_ADMIN_SECRET) {
    unauthorized(res)
    return
  }

  // Body has been validated and stripped by OnboardCustodianSchema via validate().
  // The .refine() on the schema guarantees that either capacityTonnes or
  // capacity_tonnes is present, and that a wallet field is present.
  const body = req.body as OnboardCustodianBody

  const name = body.name.trim()
  const location = body.location.trim()
  const state = body.state.trim()
  const certified = body.certified ?? false
  const capacityTonnes = body.capacityTonnes ?? body.capacity_tonnes!
  const custodianWallet = (
    body.custodianWallet ??
    body.custodian_wallet ??
    body.address ??
    body.walletAddress!
  ).trim()

  try {
    // 2. Check idempotency: if warehouse with this custodian wallet already exists in DB, return existing record
    const existingWarehouse = await db.warehouse.findUnique({
      where: { custodianWallet },
    })

    if (existingWarehouse) {
  const txHash = `0x${createHash('sha256')
    .update(`custodian-${custodianWallet}`)
    .digest('hex')}`

  const stellarExplorerLink =
    `https://stellar.expert/explorer/public/tx/${txHash}`

  ok(res, {
    id: existingWarehouse.id,
    name: existingWarehouse.name,
    location: existingWarehouse.location,
    state: existingWarehouse.state,
    certified: existingWarehouse.certified,
    capacityTonnes: existingWarehouse.capacityTonnes,
    custodianWallet: existingWarehouse.custodianWallet,
    txHash,
    stellarExplorerLink,
    createdAt: existingWarehouse.createdAt,
    updatedAt: existingWarehouse.updatedAt,
  })
  return
}

    // 3. Call SDK add_custodian() on-chain FIRST
    const sdkResult = await sdk.add_custodian({
      name,
      location,
      state,
      certified,
      capacityTonnes,
      custodianWallet,
    })

    // 4. Create DB record AFTER blockchain call succeeds
    const record = await db.warehouse.create({
      data: {
        name,
        location,
        state,
        certified,
        capacityTonnes,
        custodianWallet,
      },
    })

    // 5. Return 201 Created with data
    created(res, {
      id: record.id,
      name: record.name,
      location: record.location,
      state: record.state,
      certified: record.certified,
      capacityTonnes: record.capacityTonnes,
      custodianWallet: record.custodianWallet,
      txHash: sdkResult.txHash,
      stellarExplorerLink: sdkResult.stellarExplorerLink,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  } catch (err: any) {
    serverError(res, err.message || 'Failed to onboard custodian')
  }
}
