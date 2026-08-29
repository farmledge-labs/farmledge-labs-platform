/**
 * Stellar Lock Service — LEND-3
 *
 * Handles the on-chain side of locking a token as collateral.
 *
 * Lock mechanism:
 *   A Stellar `manageData` operation is written to the platform issuer account.
 *   The data entry encodes which lender + loan has locked this token so the
 *   state is permanently recorded on-chain and independently auditable.
 *
 *   Key:   "LOCK:{tokenId}"          (max 64 bytes — tokenId format KN-2026-000042 fits)
 *   Value: "{lender_id}|{loan_ref}"  (max 64 bytes — truncated with warning if longer)
 *
 * The platform signs with STELLAR_PLATFORM_SECRET.  In production this key
 * should be a multisig threshold key held by the custodian committee — that
 * architecture is out of scope for LEND-3.
 *
 * To UNLOCK later, a subsequent manageData with value=null clears the entry.
 */

import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Memo,
} from '@stellar/stellar-sdk'
import pino from 'pino'

const logger = pino({ name: 'stellar-lock' })

/** Result of a successful lock submission */
export interface LockResult {
  /** Stellar transaction hash of the lock tx */
  txHash: string
  /** Stellar explorer link */
  explorerLink: string
}

/** Dependency bundle injected by the controller — keeps the service testable. */
export interface LockDeps {
  horizonUrl: string
  platformSecret: string
  /** 'testnet' | 'mainnet' — maps to Networks constant */
  network: string
}

/**
 * Build the manageData key for a token lock.
 * Exported for testing.
 */
export function buildLockKey(tokenId: string): string {
  // Stellar data entry keys are max 64 bytes.
  // "LOCK:" (5) + tokenId (e.g. "KN-2026-000042" = 14) = 19 — well within limit.
  return `LOCK:${tokenId}`
}

/**
 * Build the manageData value for a token lock.
 * Exported for testing.
 *
 * Format: "{lender_id}|{loan_reference}"
 * Stellar data entry values are max 64 bytes.
 * We truncate at 64 bytes and log a warning if the combined string exceeds it.
 */
export function buildLockValue(lenderId: string, loanReference: string): Buffer {
  const raw = `${lenderId}|${loanReference}`
  const bytes = Buffer.from(raw, 'utf8')
  if (bytes.length > 64) {
    logger.warn(
      { lenderId, loanReference, length: bytes.length },
      'Lock value exceeds 64 bytes — truncating to fit Stellar manageData limit',
    )
    return bytes.subarray(0, 64)
  }
  return bytes
}

/**
 * Resolve the Stellar Networks passphrase from a human-readable network name.
 */
function resolveNetworkPassphrase(network: string): string {
  if (network === 'mainnet' || network === 'public') {
    return Networks.PUBLIC
  }
  return Networks.TESTNET
}

/**
 * Build the Stellar explorer URL for a transaction hash.
 */
function explorerLink(txHash: string, network: string): string {
  const net = network === 'mainnet' || network === 'public' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`
}

/**
 * Submit a lock transaction to the Stellar network.
 *
 * Steps:
 *  1. Load the platform account from Horizon (for current sequence number)
 *  2. Build a TransactionBuilder with a manageData operation
 *  3. Sign with the platform keypair
 *  4. Submit via Horizon
 *
 * Throws on any Horizon or network error — caller handles error mapping.
 */
export async function submitLockTransaction(
  tokenId: string,
  lenderId: string,
  loanReference: string,
  deps: LockDeps,
): Promise<LockResult> {
  const server = new Horizon.Server(deps.horizonUrl)
  const keypair = Keypair.fromSecret(deps.platformSecret)
  const networkPassphrase = resolveNetworkPassphrase(deps.network)

  logger.info({ tokenId, lenderId, loanReference }, 'Loading platform account from Horizon')

  const account = await server.loadAccount(keypair.publicKey())

  const lockKey = buildLockKey(tokenId)
  const lockValue = buildLockValue(lenderId, loanReference)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.manageData({
        name: lockKey,
        value: lockValue,
      }),
    )
    .addMemo(Memo.text(`LOCK:${tokenId}`))
    .setTimeout(30)
    .build()

  tx.sign(keypair)

  logger.info({ tokenId, lockKey }, 'Submitting lock transaction to Horizon')

  const result = await server.submitTransaction(tx)
  const hash = result.hash

  logger.info({ tokenId, txHash: hash }, 'Lock transaction confirmed')

  return {
    txHash: hash,
    explorerLink: explorerLink(hash, deps.network),
  }
}
