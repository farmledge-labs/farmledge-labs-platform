/**
 * STELLAR-5 — Token Reconciliation Job
 *
 * Runs every 15 minutes via node-cron. Queries Horizon for every
 * transaction recorded in the DB and corrects any status drift so the
 * DB always reflects the chain (the source of truth).
 *
 * Drift corrections handled:
 *  • DB status is `active`      but chain tx is missing → mark `exited`
 *  • DB status is `active`      but chain shows transfer memo → mark `transferred`
 *  • DB isLocked = true         but no corresponding lock on chain → unlock
 *
 * The job NEVER writes to the chain — it only corrects the DB.
 */

import cron from 'node-cron'
import { Horizon } from '@stellar/stellar-sdk'
import { db as realDb } from '../lib/db.js'
import { env } from '../config/env.js'
import { TokenStatus } from '@prisma/client'
import pino from 'pino'

const logger = pino({ name: 'reconcile-job' })

// ── DB interface ──────────────────────────────────────────────────────────────

/**
 * Minimal interface of the Prisma token model operations used by this job.
 * Expressed as a plain interface so tests can inject a stub without needing
 * a real database connection.
 */
export interface TokenRepository {
  findMany(args: {
    select: {
      id: true
      tokenId: true
      txHash: true
      status: true
      isLocked: true
    }
  }): Promise<
    Array<{
      id: string
      tokenId: string
      txHash: string
      status: TokenStatus
      isLocked: boolean
    }>
  >
  update(args: {
    where: { id: string }
    data: Partial<{ status: TokenStatus; isLocked: boolean }>
  }): Promise<unknown>
}

// ── Horizon client ────────────────────────────────────────────────────────────

/**
 * Build a Horizon Server instance. Exported so tests can swap it out.
 */
export function buildHorizonServer(horizonUrl: string): Horizon.Server {
  return new Horizon.Server(horizonUrl)
}

// ── Chain-state helpers ───────────────────────────────────────────────────────

/**
 * Derive the canonical on-chain status for a token from its Horizon
 * transaction record.
 *
 *  - If the tx cannot be fetched (404 / network error) we treat the token
 *    as `exited` (conservative: something went wrong on chain).
 *  - If the tx memo contains "TRANSFER" we treat the token as `transferred`.
 *  - Otherwise we leave it `active`.
 *
 * Returns `null` when the chain state cannot be determined (Horizon
 * temporarily unavailable) — the caller should skip that token.
 */
export async function deriveChainStatus(
  server: Horizon.Server,
  txHash: string,
): Promise<TokenStatus | null> {
  try {
    const tx = await server.transactions().transaction(txHash).call()

    // Treat a "TRANSFER" memo as transferred
    if (
      tx.memo_type === 'text' &&
      typeof tx.memo === 'string' &&
      tx.memo.toUpperCase().includes('TRANSFER')
    ) {
      return TokenStatus.transferred
    }

    return TokenStatus.active
  } catch (err: unknown) {
    // Horizon 404 → transaction gone from ledger: treat as exited
    if (isHorizonNotFound(err)) {
      return TokenStatus.exited
    }

    // Any other error (network blip etc.) → skip this token this cycle
    logger.warn({ txHash, err }, 'Could not fetch tx from Horizon; skipping')
    return null
  }
}

/** Returns true when the error is a Horizon 404 response. */
function isHorizonNotFound(err: unknown): boolean {
  if (err != null && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { status?: number } }).response
    return response?.status === 404
  }
  return false
}

// ── Core reconciliation logic ─────────────────────────────────────────────────

export interface ReconcileResult {
  checked: number
  corrected: number
  errors: number
}

/**
 * Reconcile a single token against the live chain.
 *
 * Accepts an injectable `tokenRepo` so unit tests can run without a real DB.
 * Returns `true` when a DB correction was made, `false` when in sync.
 */
export async function reconcileToken(
  server: Horizon.Server,
  token: { id: string; tokenId: string; txHash: string; status: TokenStatus; isLocked: boolean },
  tokenRepo: TokenRepository,
): Promise<boolean> {
  const chainStatus = await deriveChainStatus(server, token.txHash)

  if (chainStatus === null) {
    // Horizon temporarily unreachable for this tx — skip
    return false
  }

  const updates: Partial<{ status: TokenStatus; isLocked: boolean }> = {}

  if (chainStatus !== token.status) {
    logger.info(
      { tokenId: token.tokenId, dbStatus: token.status, chainStatus },
      'Status drift detected — correcting DB',
    )
    updates.status = chainStatus
  }

  // If token is no longer active on chain, force-unlock it in the DB
  if (chainStatus !== TokenStatus.active && token.isLocked) {
    logger.info(
      { tokenId: token.tokenId },
      'Token no longer active on chain but still locked in DB — unlocking',
    )
    updates.isLocked = false
  }

  if (Object.keys(updates).length === 0) {
    return false // already in sync
  }

  await tokenRepo.update({
    where: { id: token.id },
    data: updates,
  })

  return true
}

/**
 * Main reconciliation run: loads all DB tokens and reconciles each one.
 *
 * Accepts an injectable `tokenRepo` for testability; production callers
 * pass `realDb.token`.
 */
export async function runReconciliation(
  server: Horizon.Server,
  tokenRepo: TokenRepository = realDb.token as unknown as TokenRepository,
): Promise<ReconcileResult> {
  logger.info('Starting token reconciliation run')

  const tokens = await tokenRepo.findMany({
    select: {
      id: true,
      tokenId: true,
      txHash: true,
      status: true,
      isLocked: true,
    },
  })

  let corrected = 0
  let errors = 0

  for (const token of tokens) {
    try {
      const wasCorrected = await reconcileToken(server, token, tokenRepo)
      if (wasCorrected) corrected++
    } catch (err) {
      errors++
      logger.error({ tokenId: token.tokenId, err }, 'Error reconciling token')
    }
  }

  logger.info(
    { checked: tokens.length, corrected, errors },
    'Reconciliation run complete',
  )

  return { checked: tokens.length, corrected, errors }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Register and start the cron job.
 * Returns the scheduled task so callers can `.stop()` it (e.g. in tests).
 */
export function startReconcileJob(): cron.ScheduledTask {
  const server = buildHorizonServer(env.HORIZON_URL)

  logger.info('Registering reconciliation job (*/15 * * * *)')

  const task = cron.schedule('*/15 * * * *', async () => {
    try {
      await runReconciliation(server)
    } catch (err) {
      logger.error({ err }, 'Unhandled error in reconciliation job')
    }
  })

  return task
}
