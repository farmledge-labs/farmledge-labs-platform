import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatWeight,
  formatBags,
  formatCommodity,
  formatTokenId,
  formatDate,
} from '../../src/utils/formatters.js'

// ============================================================================
// formatWeight Tests
// ============================================================================

test('formatWeight: formats large numbers with thousands separator', () => {
  const result = formatWeight(4000)
  assert.equal(result, '4,000 kg')
})

test('formatWeight: formats small numbers without comma', () => {
  const result = formatWeight(500)
  assert.equal(result, '500 kg')
})

// ============================================================================
// formatBags Tests
// ============================================================================

test('formatBags: formats multiple bags with correct grammar', () => {
  const result = formatBags(40, 100)
  assert.equal(result, '40 × 100kg bags')
})

test('formatBags: uses singular "bag" for single bag', () => {
  const result = formatBags(1, 50)
  assert.equal(result, '1 × 50kg bag')
})

// ============================================================================
// formatCommodity Tests
// ============================================================================

test('formatCommodity: capitalizes simple commodity names', () => {
  const result = formatCommodity('maize')
  assert.equal(result, 'Maize')
})

test('formatCommodity: handles underscore-separated variants with reversal', () => {
  const result = formatCommodity('MAIZE_WHITE')
  assert.equal(result, 'White Maize')
})

// ============================================================================
// formatTokenId Tests
// ============================================================================

test('formatTokenId: upper-cases a lower-case token id', () => {
  const result = formatTokenId('kn-2026-000042')
  assert.equal(result, 'KN-2026-000042')
})

test('formatTokenId: leaves an already upper-cased token id unchanged', () => {
  const result = formatTokenId('KN-2026-000042')
  assert.equal(result, 'KN-2026-000042')
})

// ============================================================================
// formatDate Tests
// ============================================================================

test('formatDate: formats an ISO timestamp as "DD Mon YYYY"', () => {
  const result = formatDate('2026-03-14T00:00:00Z')
  assert.equal(result, '14 Mar 2026')
})

test('formatDate: uses UTC so a late-day timestamp keeps the same calendar date', () => {
  const result = formatDate('2026-12-31T23:59:59Z')
  assert.equal(result, '31 Dec 2026')
})
