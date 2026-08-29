/**
 * Lender-facing API types — LEND-2 / LEND-3
 */

// ── LEND-3 — Lock token ───────────────────────────────────────────────────────

/** Validated request body for POST /lender/tokens/:token_id/lock */
export interface LockRequestBody {
  lender_id: string
  loan_reference: string
}

/** Snapshot of the token included in the lock response */
export interface LockedTokenSnapshot {
  id: string
  tokenId: string
  commodity: string
  grade: string
  bagCount: number
  weightPerBagKg: number
  totalWeightKg: number
  status: string
  txHash: string
  depositDate: string
}

/** Response body for a successful lock */
export interface LockTokenResponse {
  /** Human-readable token ID */
  tokenId: string
  /** Always true on success */
  isLocked: boolean
  /** Lender ID that applied the lock */
  lockedByLenderId: string
  /** Loan reference recorded on-chain and in DB */
  loanReference: string
  /** Stellar transaction hash of the lock manageData tx */
  lockTxHash: string
  /** Stellar explorer link for the lock tx */
  lockExplorerLink: string
  /** ISO 8601 timestamp of when the lock was applied */
  lockedAt: string
  /** Token details at the time of locking */
  token: LockedTokenSnapshot
}

// ── LEND-2 — Verify token ─────────────────────────────────────────────────────

/** On-chain status as seen by Horizon at the time of the request. */
export type ChainStatusLive =
  | 'active'
  | 'transferred'
  | 'exited'
  | 'unreachable'

/** Aggregated lendability flag */
export type LendabilityVerdict = 'ELIGIBLE' | 'INELIGIBLE'

/** Individual verification flag */
export interface VerificationFlag {
  flag: string
  passed: boolean
  note: string
}

/** Deep verification report (LEND-2) */
export interface VerifyTokenReport {
  id: string
  tokenId: string
  commodity: string
  grade: string
  bagCount: number
  weightPerBagKg: number
  totalWeightKg: number
  txHash: string
  stellarExplorerLink: string
  depositDate: string
  exitDate: string | null
  dbStatus: string
  chainStatus: ChainStatusLive
  chainStatusMatch: boolean
  isLocked: boolean
  lockedByLenderId: string | null
  loanReference: string | null
  warehouse: {
    id: string
    name: string
    location: string
    state: string
    certified: boolean
  }
  farmer: {
    id: string
    fullName: string
    bvnVerified: boolean
  }
  /** NGN-denominated — deliberate exception per LEND-2 spec */
  estimatedValueNgn: number
  pricePerKgNgn: number
  verificationFlags: VerificationFlag[]
  verdict: LendabilityVerdict
  reportGeneratedAt: string
}
