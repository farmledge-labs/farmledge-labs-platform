/**
 * Types for the LEND-2 deep token verification report.
 *
 * NOTE: NGN values appear ONLY in this report.  Every other Farmledge view
 * shows physical quantities.  Lenders need an estimated collateral value to
 * make a loan decision — that is the deliberate exception documented in LEND-2.
 *
 * These types are also exported from packages/shared for frontend consumers.
 * The API sources them here to avoid a circular build dependency on the
 * shared package's dist artefacts.
 */

/** On-chain status as seen by Horizon at the time of the request. */
export type ChainStatusLive =
  | 'active'       // tx found, no transfer memo
  | 'transferred'  // tx found with TRANSFER memo
  | 'exited'       // tx not found (404) — token has left the ledger
  | 'unreachable'  // Horizon could not be reached — status unknown

/** Aggregated lendability flag */
export type LendabilityVerdict = 'ELIGIBLE' | 'INELIGIBLE'

/** Individual verification flag contributing to overall lendability. */
export interface VerificationFlag {
  /** Machine-readable flag name */
  flag: string
  /** True = check passed, false = check failed */
  passed: boolean
  /** Human-readable explanation for the lender */
  note: string
}

/**
 * Deep verification report returned by GET /api/v1/lender/tokens/:token_id/verify
 *
 * All timestamps are ISO 8601 strings.
 * estimatedValueNgn is an integer in whole Naira.  It MUST only appear in
 * this response type and nowhere else in the API response surface.
 */
export interface VerifyTokenReport {
  /** Internal DB UUID of the token */
  id: string
  /** Human-readable token ID (e.g. KN-2026-000042) */
  tokenId: string

  /** Physical commodity details */
  commodity: string
  grade: string
  bagCount: number
  weightPerBagKg: number
  totalWeightKg: number

  /** On-chain anchoring */
  txHash: string
  stellarExplorerLink: string

  /** DB-recorded lifecycle dates */
  depositDate: string
  exitDate: string | null

  /** DB status at time of request */
  dbStatus: string

  /** Live chain status queried from Horizon at request time */
  chainStatus: ChainStatusLive

  /** True when dbStatus and chainStatus agree */
  chainStatusMatch: boolean

  /** Lock status */
  isLocked: boolean
  lockedByLenderId: string | null
  loanReference: string | null

  /** Warehouse details */
  warehouse: {
    id: string
    name: string
    location: string
    state: string
    /** Whether the warehouse holds a platform certification */
    certified: boolean
  }

  /** Farmer details */
  farmer: {
    id: string
    fullName: string
    /** Whether the farmer's BVN has been verified */
    bvnVerified: boolean
  }

  /**
   * Estimated collateral value in whole Naira.
   *
   * Computed as: totalWeightKg × price_per_kg(commodity, grade)
   * Uses the same price table as LEND-1 (commodity-price.service.ts).
   *
   * This is the ONLY place NGN values appear in the Farmledge API surface.
   */
  estimatedValueNgn: number

  /** Per-kg price used for this estimate */
  pricePerKgNgn: number

  /** Individual verification checks */
  verificationFlags: VerificationFlag[]

  /** Overall lendability verdict */
  verdict: LendabilityVerdict

  /** ISO 8601 timestamp at which this report was generated */
  reportGeneratedAt: string
}
