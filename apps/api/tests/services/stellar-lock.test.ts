/**
 * tests/services/stellar-lock.test.ts
 *
 * Unit tests for the pure helper functions in stellar-lock.service.ts.
 * No network I/O — submitLockTransaction is not called here.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLockKey,
  buildLockValue,
} from '../../src/services/stellar-lock.service.js'

describe('buildLockKey', () => {
  test('prepends LOCK: prefix to tokenId', () => {
    assert.equal(buildLockKey('KN-2026-000001'), 'LOCK:KN-2026-000001')
  })

  test('works for all token ID formats', () => {
    assert.equal(buildLockKey('KD-2026-000042'), 'LOCK:KD-2026-000042')
    assert.equal(buildLockKey('KN-2026-999999'), 'LOCK:KN-2026-999999')
  })

  test('result is within Stellar 64-byte data key limit', () => {
    // Worst realistic case: "LOCK:" (5) + longest tokenId (e.g. 20 chars) = 25
    const key = buildLockKey('KN-2026-000042-EXTRA-LONG')
    assert.ok(
      Buffer.byteLength(key, 'utf8') <= 64,
      `Key "${key}" exceeds 64 bytes`,
    )
  })
})

describe('buildLockValue', () => {
  test('formats as lender_id|loan_reference', () => {
    const val = buildLockValue('LENDER-ACCESS-BANK-001', 'LOAN-2026-001')
    assert.equal(val.toString('utf8'), 'LENDER-ACCESS-BANK-001|LOAN-2026-001')
  })

  test('returns a Buffer', () => {
    const val = buildLockValue('lender-1', 'LOAN-001')
    assert.ok(val instanceof Buffer)
  })

  test('result is within Stellar 64-byte data value limit for typical inputs', () => {
    const val = buildLockValue('LENDER-ACCESS-BANK-001', 'LOAN-2026-001')
    assert.ok(val.length <= 64, `Value length ${val.length} exceeds 64 bytes`)
  })

  test('truncates to 64 bytes when combined string is too long', () => {
    const longLenderId = 'L'.repeat(40)
    const longLoan = 'R'.repeat(40)
    const val = buildLockValue(longLenderId, longLoan)
    assert.equal(val.length, 64)
  })

  test('exact 64-byte input is not truncated', () => {
    // "A".repeat(31) + "|" + "B".repeat(32) = 64 bytes
    const lenderId = 'A'.repeat(31)
    const loanRef = 'B'.repeat(32)
    const val = buildLockValue(lenderId, loanRef)
    assert.equal(val.length, 64)
    assert.equal(val.toString('utf8'), `${'A'.repeat(31)}|${'B'.repeat(32)}`)
  })

  test('63-byte input is not truncated', () => {
    // "A".repeat(31) + "|" + "B".repeat(31) = 63 bytes
    const lenderId = 'A'.repeat(31)
    const loanRef = 'B'.repeat(31)
    const val = buildLockValue(lenderId, loanRef)
    assert.equal(val.length, 63)
  })
})

describe('lock key and value round-trip', () => {
  test('key and value together encode the full lock identity', () => {
    const tokenId = 'KN-2026-000042'
    const lenderId = 'LENDER-GTB-002'
    const loanRef = 'LOAN-2026-007'

    const key = buildLockKey(tokenId)
    const value = buildLockValue(lenderId, loanRef)

    assert.equal(key, 'LOCK:KN-2026-000042')
    assert.equal(value.toString('utf8'), 'LENDER-GTB-002|LOAN-2026-007')
  })
})
