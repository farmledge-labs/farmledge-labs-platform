/**
 * LEND-2 — verifyToken controller
 *
 * GET /api/v1/lender/tokens/:token_id/verify
 *
 * Returns a deep verification report that a lender can use to assess a token
 * as collateral.  This is the ONE place in the Farmledge API where an
 * estimated NGN value is returned — see LEND-2 issue notes for rationale.
 *
 * Report includes:
 *  1. Full token record from DB (with farmer + warehouse relations)
 *  2. Live chain status queried from Horizon at request time
 *  3. DB ↔ chain status consistency check
 *  4. Warehouse certification status
 *  5. Farmer BVN verification status
 *  6. Lock status
 *  7. Estimated collateral value in NGN (from commodity-price.service)
 *  8. Per-check verification flags
 *  9. Overall ELIGIBLE / INELIGIBLE verdict
 */

import type { Request, Response } from 'express'
import pino from 'pino'
import { Horizon } from '@stellar/stellar-sdk'
import { db } from '../../lib/db.js'
import { env } from '../../config/env.js'
import { ok, notFound, serverError } from '../../utils/response.js'
import { estimateValueNgn, getPricePerKgNgn } from '../../services/commodity-price.service.js'
import type {
  VerifyTokenReport,
  VerificationFlag,
  ChainStatusLive,
  LendabilityVerdict,
} from '../../types/lender.js'

const logger = pino({ name: 'verify-token' })

// ── Horizon helpers ───────────────────────────────────────────────────────────

/**
 * Query Horizon for a transaction hash and return a normalised ChainStatusLive.
 *
 * - active      → tx found, no TRANSFER memo
 * - transferred → tx found, memo contains "TRANSFER"
 * - exited      → Horizon 404 (tx pruned / token redeemed)
 * - unreachable → any other error (network blip, rate-limit, etc.)
 */
async function queryChainStatus(txHash: string): Promise<ChainStatusLive> {
  const server = new Horizon.Server(env.HORIZON_URL)
  try {
    const tx = await server.transactions().transaction(txHash).call()

    if (
      tx.memo_type === 'text' &&
      typeof tx.memo === 'string' &&
      tx.memo.toUpperCase().includes('TRANSFER')
    ) {
      return 'transferred'
    }

    return 'active'
  } catch (err: unknown) {
    if (isHorizonNotFound(err)) {
      return 'exited'
    }
    logger.warn({ txHash, err }, 'Horizon unreachable during token verification')
    return 'unreachable'
  }
}

function isHorizonNotFound(err: unknown): boolean {
  if (err != null && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { status?: number } }).response
    return r?.status === 404
  }
  return false
}

// ── Verification flags ────────────────────────────────────────────────────────

/**
 * Build the list of individual verification checks.
 * Each flag contributes to the overall lendability verdict.
 */
function buildVerificationFlags(params: {
  dbStatus: string
  chainStatus: ChainStatusLive
  chainStatusMatch: boolean
  warehouseCertified: boolean
  farmerBvnVerified: boolean
  isLocked: boolean
}): VerificationFlag[] {
  const {
    dbStatus,
    chainStatus,
    chainStatusMatch,
    warehouseCertified,
    farmerBvnVerified,
    isLocked,
  } = params

  return [
    {
      flag: 'TOKEN_ACTIVE_ON_CHAIN',
      passed: chainStatus === 'active',
      note:
        chainStatus === 'active'
          ? 'Token transaction is active on the Stellar ledger.'
          : chainStatus === 'unreachable'
            ? 'Horizon could not be reached — chain status is unknown.'
            : `Token is no longer active on chain (chain status: ${chainStatus}).`,
    },
    {
      flag: 'DB_CHAIN_STATUS_MATCH',
      passed: chainStatusMatch,
      note: chainStatusMatch
        ? `DB status (${dbStatus}) matches live chain status (${chainStatus}).`
        : `Status mismatch: DB reports "${dbStatus}" but chain reports "${chainStatus}". Reconciliation job may not have run yet.`,
    },
    {
      flag: 'WAREHOUSE_CERTIFIED',
      passed: warehouseCertified,
      note: warehouseCertified
        ? 'Warehouse holds a valid platform certification.'
        : 'Warehouse is NOT platform-certified. Collateral quality cannot be guaranteed.',
    },
    {
      flag: 'FARMER_BVN_VERIFIED',
      passed: farmerBvnVerified,
      note: farmerBvnVerified
        ? 'Farmer identity has been BVN-verified.'
        : 'Farmer BVN has not been verified. Identity risk is elevated.',
    },
    {
      flag: 'TOKEN_NOT_LOCKED',
      passed: !isLocked,
      note: isLocked
        ? 'Token is already locked as collateral for another loan. It cannot be used as collateral again until unlocked.'
        : 'Token is not currently locked — it is available as collateral.',
    },
  ]
}

/**
 * Derive overall verdict from flags.
 *
 * A token is ELIGIBLE only when ALL flags pass.
 * If Horizon is unreachable we still apply the same rule — the
 * TOKEN_ACTIVE_ON_CHAIN flag will have passed=false and the token will be
 * INELIGIBLE.  Lenders must not commit to loans under uncertainty.
 */
function deriveVerdict(flags: VerificationFlag[]): LendabilityVerdict {
  return flags.every((f) => f.passed) ? 'ELIGIBLE' : 'INELIGIBLE'
}

// ── Controller ────────────────────────────────────────────────────────────────

export async function verifyTokenController(req: Request, res: Response): Promise<void> {
  const token_id = req.params['token_id']

  if (!token_id) {
    notFound(res, 'token_id param is required')
    return
  }

  logger.info({ token_id }, 'Token verification requested')

  // ── 1. Fetch token from DB with farmer + warehouse ─────────────────────────
  let token: Awaited<ReturnType<typeof db.token.findUnique>> & {
    farmer: { id: string; fullName: string; bvnVerified: boolean }
    warehouse: { id: string; name: string; location: string; state: string; certified: boolean }
  } | null

  try {
    token = await db.token.findUnique({
      where: { tokenId: token_id },
      include: {
        farmer: {
          select: {
            id: true,
            fullName: true,
            bvnVerified: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            certified: true,
          },
        },
      },
    }) as typeof token
  } catch (err: unknown) {
    logger.error({ token_id, err }, 'DB error fetching token for verification')
    serverError(res, 'Failed to fetch token from database')
    return
  }

  if (!token) {
    notFound(res, `Token "${token_id}" not found`)
    return
  }

  // ── 2. Query live chain status from Horizon ────────────────────────────────
  let chainStatus: ChainStatusLive
  try {
    chainStatus = await queryChainStatus(token.txHash)
  } catch (err: unknown) {
    logger.error({ token_id, txHash: token.txHash, err }, 'Unexpected error querying Horizon')
    serverError(res, 'Failed to query chain status')
    return
  }

  // ── 3. Compute derived values ──────────────────────────────────────────────
  const dbStatus = token.status as string
  const chainStatusMatch = dbStatus === chainStatus

  // Compute NGN estimate — deliberate exception per LEND-2 spec
  let pricePerKgNgn: number
  let estimatedValueNgnResult: number
  try {
    pricePerKgNgn = getPricePerKgNgn(token.commodity, token.grade)
    estimatedValueNgnResult = estimateValueNgn(token.commodity, token.grade, token.totalWeightKg)
  } catch (err: unknown) {
    logger.error({ commodity: token.commodity, grade: token.grade, err }, 'Price lookup failed')
    serverError(res, 'Failed to compute estimated value — unknown commodity/grade combination')
    return
  }

  // ── 4. Build verification flags ────────────────────────────────────────────
  const verificationFlags = buildVerificationFlags({
    dbStatus,
    chainStatus,
    chainStatusMatch,
    warehouseCertified: token.warehouse.certified,
    farmerBvnVerified: token.farmer.bvnVerified,
    isLocked: token.isLocked,
  })

  const verdict = deriveVerdict(verificationFlags)

  // ── 5. Assemble and return report ──────────────────────────────────────────
  const report: VerifyTokenReport = {
    id: token.id,
    tokenId: token.tokenId,

    commodity: token.commodity,
    grade: token.grade,
    bagCount: token.bagCount,
    weightPerBagKg: token.weightPerBagKg,
    totalWeightKg: token.totalWeightKg,

    txHash: token.txHash,
    stellarExplorerLink: token.stellarExplorerLink,

    depositDate: token.depositDate.toISOString(),
    exitDate: token.exitDate != null ? token.exitDate.toISOString() : null,

    dbStatus,
    chainStatus,
    chainStatusMatch,

    isLocked: token.isLocked,
    lockedByLenderId: token.lockedByLenderId,
    loanReference: token.loanReference,

    warehouse: {
      id: token.warehouse.id,
      name: token.warehouse.name,
      location: token.warehouse.location,
      state: token.warehouse.state,
      certified: token.warehouse.certified,
    },

    farmer: {
      id: token.farmer.id,
      fullName: token.farmer.fullName,
      bvnVerified: token.farmer.bvnVerified,
    },

    estimatedValueNgn: estimatedValueNgnResult,
    pricePerKgNgn,

    verificationFlags,
    verdict,

    reportGeneratedAt: new Date().toISOString(),
  }

  logger.info(
    { token_id, verdict, chainStatus, dbStatus, estimatedValueNgn: estimatedValueNgnResult },
    'Token verification complete',
  )

  ok(res, report)
}
