/**
 * tests/jobs/reconcile.test.ts
 *
 * Unit tests for the STELLAR-5 reconciliation job.
 *
 * All external I/O (Horizon, Prisma DB) is replaced with in-test stubs
 * passed as arguments — no network or database connection required.
 *
 * Drift scenarios covered:
 *  1. Token is `active` in DB but tx is gone (404) → corrected to `exited`
 *  2. Token is `active` in DB but tx has "TRANSFER" memo → corrected to `transferred`
 *  3. Token is already `transferred` in DB and chain agrees → no update made
 *  4. Token is `active` + `isLocked=true` but chain shows 404 → unlocked + exited
 *  5. Horizon returns non-404 error → token skipped, no update
 *  6. Multiple tokens in one run — corrected count matches drift count exactly
 *  7. Locked token on chain-404 → update carries both status=exited and isLocked=false
 *  8. Errors on one token do not abort the rest of the run
 */

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Horizon } from '@stellar/stellar-sdk'
import { TokenStatus } from '@prisma/client'
import type { TokenRepository } from '../../src/jobs/reconcile.job.js'
import {
  deriveChainStatus,
  reconcileToken,
  runReconciliation,
} from '../../src/jobs/reconcile.job.js'

// ── Horizon stub factory ──────────────────────────────────────────────────────

type TxRecord = {
  memo_type?: string
  memo?: string
}

/**
 * Build a minimal Horizon.Server stub whose
 * `transactions().transaction(hash).call()` either resolves with `txRecord`
 * or rejects with `error`.
 */
function makeHorizonStub(
  txRecord: TxRecord | null,
  error?: { response?: { status: number } },
): Horizon.Server {
  const callFn = async (): Promise<TxRecord> => {
    if (error) throw error
    return txRecord as TxRecord
  }
  return {
    transactions: () => ({
      transaction: (_hash: string) => ({ call: callFn }),
    }),
  } as unknown as Horizon.Server
}

/**
 * Build a Horizon stub that dispatches per tx hash.
 * `map` is { [txHash]: TxRecord | Error }
 */
function makeHorizonDispatch(
  map: Record<string, TxRecord | { response: { status: number } }>,
): Horizon.Server {
  return {
    transactions: () => ({
      transaction: (hash: string) => ({
        call: async () => {
          const entry = map[hash]
          if (!entry) throw { response: { status: 404 } }
          if ('response' in entry) throw entry
          return entry as TxRecord
        },
      }),
    }),
  } as unknown as Horizon.Server
}

// ── TokenRepository stub factory ──────────────────────────────────────────────

type TokenRow = {
  id: string
  tokenId: string
  txHash: string
  status: TokenStatus
  isLocked: boolean
}

interface UpdateCall {
  where: { id: string }
  data: Partial<{ status: TokenStatus; isLocked: boolean }>
}

function makeTokenRepo(rows: TokenRow[]): TokenRepository & { updateCalls: UpdateCall[] } {
  const updateCalls: UpdateCall[] = []
  const repo: TokenRepository & { updateCalls: UpdateCall[] } = {
    updateCalls,
    findMany: async () => rows,
    update: async (args) => {
      updateCalls.push(args as UpdateCall)
      // Reflect update into rows so callers can inspect final state
      const idx = rows.findIndex((r) => r.id === (args.where as { id: string }).id)
      if (idx !== -1) {
        rows[idx] = { ...rows[idx]!, ...(args.data as Partial<TokenRow>) }
      }
    },
  }
  return repo
}

// ── Token fixture factory ─────────────────────────────────────────────────────

function makeToken(overrides: Partial<TokenRow> = {}): TokenRow {
  return {
    id: 'token-uuid-1',
    tokenId: 'KN-2026-000001',
    txHash: 'abc123',
    status: TokenStatus.active,
    isLocked: false,
    ...overrides,
  }
}

// ── deriveChainStatus ─────────────────────────────────────────────────────────

describe('deriveChainStatus', () => {
  test('returns `exited` when Horizon responds with 404', async () => {
    const server = makeHorizonStub(null, { response: { status: 404 } })
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, TokenStatus.exited)
  })

  test('returns `transferred` when tx memo contains "TRANSFER"', async () => {
    const server = makeHorizonStub({ memo_type: 'text', memo: 'TRANSFER/KN-2026-000001' })
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, TokenStatus.transferred)
  })

  test('memo check is case-insensitive', async () => {
    const server = makeHorizonStub({ memo_type: 'text', memo: 'transfer payment' })
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, TokenStatus.transferred)
  })

  test('returns `active` when tx exists with no transfer memo', async () => {
    const server = makeHorizonStub({ memo_type: 'text', memo: 'DEPOSIT/KN-2026-000001' })
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, TokenStatus.active)
  })

  test('returns null on non-404 Horizon error', async () => {
    const server = makeHorizonStub(null, { response: { status: 500 } })
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, null)
  })

  test('returns null on network-level error (no response object)', async () => {
    const server = makeHorizonStub(null, {} /* no .response */)
    const result = await deriveChainStatus(server, 'any-hash')
    assert.equal(result, null)
  })
})

// ── reconcileToken ────────────────────────────────────────────────────────────

describe('reconcileToken — drift corrections', () => {
  test('Scenario 1: active in DB, 404 on chain → corrected to exited', async () => {
    const token = makeToken({ status: TokenStatus.active })
    const repo = makeTokenRepo([token])
    const server = makeHorizonStub(null, { response: { status: 404 } })

    const wasCorrected = await reconcileToken(server, token, repo)

    assert.equal(wasCorrected, true)
    assert.equal(repo.updateCalls.length, 1)
    assert.equal(repo.updateCalls[0]?.data.status, TokenStatus.exited)
  })

  test('Scenario 2: active in DB, TRANSFER memo on chain → corrected to transferred', async () => {
    const token = makeToken({ status: TokenStatus.active })
    const repo = makeTokenRepo([token])
    const server = makeHorizonStub({ memo_type: 'text', memo: 'TRANSFER/abc' })

    const wasCorrected = await reconcileToken(server, token, repo)

    assert.equal(wasCorrected, true)
    assert.equal(repo.updateCalls.length, 1)
    assert.equal(repo.updateCalls[0]?.data.status, TokenStatus.transferred)
  })

  test('Scenario 3: transferred in DB, chain also shows transfer → no update', async () => {
    const token = makeToken({ status: TokenStatus.transferred })
    const repo = makeTokenRepo([token])
    const server = makeHorizonStub({ memo_type: 'text', memo: 'TRANSFER/abc' })

    const wasCorrected = await reconcileToken(server, token, repo)

    assert.equal(wasCorrected, false)
    assert.equal(repo.updateCalls.length, 0)
  })

  test('Scenario 4: active + isLocked in DB, 404 on chain → update has status=exited and isLocked=false', async () => {
    const token = makeToken({ status: TokenStatus.active, isLocked: true })
    const repo = makeTokenRepo([token])
    const server = makeHorizonStub(null, { response: { status: 404 } })

    const wasCorrected = await reconcileToken(server, token, repo)

    assert.equal(wasCorrected, true)
    assert.equal(repo.updateCalls.length, 1)
    assert.equal(repo.updateCalls[0]?.data.status, TokenStatus.exited)
    assert.equal(repo.updateCalls[0]?.data.isLocked, false)
  })

  test('Scenario 5: Horizon returns non-404 → skipped, no update', async () => {
    const token = makeToken({ status: TokenStatus.active })
    const repo = makeTokenRepo([token])
    const server = makeHorizonStub(null, { response: { status: 503 } })

    const wasCorrected = await reconcileToken(server, token, repo)

    assert.equal(wasCorrected, false)
    assert.equal(repo.updateCalls.length, 0)
  })
})

// ── runReconciliation ─────────────────────────────────────────────────────────

describe('runReconciliation — full run', () => {
  test('Scenario 6: multiple tokens — corrected count matches drift count', async () => {
    const drifted = makeToken({ id: 'id-1', tokenId: 'KN-001', txHash: 'hash-1', status: TokenStatus.active })
    const healthy = makeToken({ id: 'id-2', tokenId: 'KN-002', txHash: 'hash-2', status: TokenStatus.active })

    const repo = makeTokenRepo([drifted, healthy])
    const server = makeHorizonDispatch({
      // hash-1 → 404 (drifted)
      'hash-2': { memo_type: 'text', memo: 'DEPOSIT/KN-002' }, // healthy
    })

    const result = await runReconciliation(server, repo)

    assert.equal(result.checked, 2)
    assert.equal(result.corrected, 1)
    assert.equal(result.errors, 0)

    // Verify which token was updated
    assert.equal(repo.updateCalls.length, 1)
    assert.equal(repo.updateCalls[0]?.where.id, 'id-1')
    assert.equal(repo.updateCalls[0]?.data.status, TokenStatus.exited)
  })

  test('Scenario 7: locked token on chain-404 → status=exited, isLocked=false', async () => {
    const locked = makeToken({
      id: 'id-locked',
      tokenId: 'KN-003',
      txHash: 'hash-locked',
      status: TokenStatus.active,
      isLocked: true,
    })

    const repo = makeTokenRepo([locked])
    const server = makeHorizonStub(null, { response: { status: 404 } })

    const result = await runReconciliation(server, repo)

    assert.equal(result.corrected, 1)
    assert.equal(repo.updateCalls.length, 1)
    assert.equal(repo.updateCalls[0]?.data.status, TokenStatus.exited)
    assert.equal(repo.updateCalls[0]?.data.isLocked, false)
  })

  test('Scenario 8: error on one token does not abort run; error count incremented', async () => {
    const bad = makeToken({ id: 'id-bad', tokenId: 'KN-BAD', txHash: 'hash-bad' })
    const good = makeToken({ id: 'id-good', tokenId: 'KN-GOOD', txHash: 'hash-good', status: TokenStatus.active })

    // Repo whose update throws for the bad token
    const brokenRepo: TokenRepository & { updateCalls: UpdateCall[] } = {
      updateCalls: [],
      findMany: async () => [bad, good],
      update: async (args) => {
        const id = (args.where as { id: string }).id
        if (id === 'id-bad') throw new Error('simulated DB write failure')
        brokenRepo.updateCalls.push(args as UpdateCall)
      },
    }

    const server = makeHorizonDispatch({
      // hash-bad → 404, so reconcileToken will call update → which throws
      'hash-good': { memo_type: 'text', memo: 'DEPOSIT' }, // in sync
    })

    const result = await runReconciliation(server, brokenRepo)

    assert.equal(result.checked, 2)
    // bad token errored; good token is in sync (active in DB, active on chain)
    assert.equal(result.corrected, 0)
    assert.equal(result.errors, 1)
  })
})
