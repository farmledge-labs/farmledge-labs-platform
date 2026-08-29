/**
 * LEND-3 — lockToken controller
 *
 * POST /api/v1/lender/tokens/:token_id/lock
 * Body: { lender_id: string, loan_reference: string }  (validated by LockSchema)
 *
 * Flow:
 *  1. Fetch token from DB — 404 if not found
 *  2. Guard: token must be active and not already locked → 409 with reason
 *  3. Call Stellar manageData lock transaction (stellar-lock.service)
 *  4. Write isLocked=true, lockedByLenderId, loanReference to DB
 *  5. Return the updated token record with the on-chain tx hash
 *
 * Idempotency note: if the same lender + loan_reference attempts to lock a
 * token that is already locked by them, we return 409 ALREADY_LOCKED rather
 * than a silent success — the caller should check before locking.
 */

import type { Request, Response } from 'express'
import pino from 'pino'
import { db } from '../../lib/db.js'
import { env } from '../../config/env.js'
import { ok, notFound, serverError } from '../../utils/response.js'
import { submitLockTransaction } from '../../services/stellar-lock.service.js'
import type { LockRequestBody, LockTokenResponse } from '../../types/lender.js'

const logger = pino({ name: 'lock-token' })

export async function lockTokenController(req: Request, res: Response): Promise<void> {
  const token_id = req.params['token_id']

  if (!token_id) {
    notFound(res, 'token_id param is required')
    return
  }

  const { lender_id, loan_reference } = req.body as LockRequestBody

  logger.info({ token_id, lender_id, loan_reference }, 'Lock token requested')

  // ── 1. Fetch token ─────────────────────────────────────────────────────────
  let token
  try {
    token = await db.token.findUnique({
      where: { tokenId: token_id },
      select: {
        id: true,
        tokenId: true,
        status: true,
        isLocked: true,
        lockedByLenderId: true,
        loanReference: true,
        txHash: true,
        commodity: true,
        grade: true,
        bagCount: true,
        weightPerBagKg: true,
        totalWeightKg: true,
        depositDate: true,
      },
    })
  } catch (err: unknown) {
    logger.error({ token_id, err }, 'DB error fetching token for lock')
    serverError(res, 'Failed to fetch token from database')
    return
  }

  if (!token) {
    notFound(res, `Token "${token_id}" not found`)
    return
  }

  // ── 2. Guard checks ────────────────────────────────────────────────────────
  if (token.status !== 'active') {
    res.status(409).json({
      success: false,
      error: `Token is not active (current status: ${token.status}). Only active tokens can be locked.`,
      code: 'TOKEN_NOT_ACTIVE',
    })
    return
  }

  if (token.isLocked) {
    res.status(409).json({
      success: false,
      error: `Token is already locked by lender "${token.lockedByLenderId}" under loan reference "${token.loanReference}".`,
      code: 'ALREADY_LOCKED',
    })
    return
  }

  // ── 3. Submit lock transaction to Stellar ──────────────────────────────────
  let lockResult: { txHash: string; explorerLink: string }
  try {
    lockResult = await submitLockTransaction(token_id, lender_id, loan_reference, {
      horizonUrl: env.HORIZON_URL,
      platformSecret: env.STELLAR_PLATFORM_SECRET,
      network: env.STELLAR_NETWORK,
    })
  } catch (err: unknown) {
    logger.error({ token_id, lender_id, err }, 'Stellar lock transaction failed')

    // Provide a specific message for common Horizon errors
    const message = isStellarError(err)
      ? `Stellar transaction failed: ${extractStellarError(err)}`
      : 'Failed to submit lock transaction to Stellar network'

    serverError(res, message)
    return
  }

  // ── 4. Write lock state to DB ──────────────────────────────────────────────
  let updated
  try {
    updated = await db.token.update({
      where: { id: token.id },
      data: {
        isLocked: true,
        lockedByLenderId: lender_id,
        loanReference: loan_reference,
      },
      select: {
        id: true,
        tokenId: true,
        status: true,
        isLocked: true,
        lockedByLenderId: true,
        loanReference: true,
        txHash: true,
        commodity: true,
        grade: true,
        bagCount: true,
        weightPerBagKg: true,
        totalWeightKg: true,
        depositDate: true,
        updatedAt: true,
      },
    })
  } catch (err: unknown) {
    // The chain tx went through but the DB write failed.
    // Log the on-chain tx hash so ops can reconcile manually.
    logger.error(
      { token_id, lender_id, lockTxHash: lockResult.txHash, err },
      'CRITICAL: lock tx confirmed on chain but DB update failed — manual reconciliation required',
    )
    serverError(res, 'Lock recorded on chain but database update failed. Please contact support.')
    return
  }

  logger.info(
    { token_id, lender_id, loan_reference, txHash: lockResult.txHash },
    'Token locked successfully',
  )

  // ── 5. Return response ─────────────────────────────────────────────────────
  const response: LockTokenResponse = {
    tokenId: updated.tokenId,
    isLocked: updated.isLocked,
    lockedByLenderId: updated.lockedByLenderId ?? lender_id,
    loanReference: updated.loanReference ?? loan_reference,
    lockTxHash: lockResult.txHash,
    lockExplorerLink: lockResult.explorerLink,
    lockedAt: updated.updatedAt.toISOString(),
    token: {
      id: updated.id,
      tokenId: updated.tokenId,
      commodity: updated.commodity,
      grade: updated.grade,
      bagCount: updated.bagCount,
      weightPerBagKg: updated.weightPerBagKg,
      totalWeightKg: updated.totalWeightKg,
      status: updated.status,
      txHash: updated.txHash,
      depositDate: updated.depositDate.toISOString(),
    },
  }

  ok(res, response)
}

// ── Stellar error helpers ─────────────────────────────────────────────────────

function isStellarError(err: unknown): boolean {
  return (
    err != null &&
    typeof err === 'object' &&
    'response' in err &&
    (err as { response?: unknown }).response != null
  )
}

function extractStellarError(err: unknown): string {
  try {
    const response = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } })
      .response
    const codes = response?.data?.extras?.result_codes
    if (codes) return JSON.stringify(codes)
  } catch {
    // ignore parse errors
  }
  return 'unknown Stellar error'
}
