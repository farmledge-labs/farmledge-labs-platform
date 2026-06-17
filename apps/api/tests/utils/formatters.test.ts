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
  assert.equal(result, '40 x 100kg bags')
})

test('formatBags: uses singular "bag" for single bag', () => {
  const result = formatBags(1, 50)
  assert.equal(result, '1 x 50kg bag')
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

test('formatTokenId: converts lowercase token ID to uppercase', () => {
  assert.equal(formatTokenId('kn-2026-000042'), 'KN-2026-000042')
})

test('formatTokenId: handles already uppercase or mixed case', () => {
  assert.equal(formatTokenId('KN-2026-mixed-01'), 'KN-2026-MIXED-01')
})

// ============================================================================
// formatDate Tests
// ============================================================================

test('formatDate: formats ISO date to human-readable format', () => {
  assert.equal(formatDate('2026-03-14T00:00:00Z'), '14 Mar 2026')
})

test('formatDate: handles single-digit day and different months', () => {
  assert.equal(formatDate('2026-01-05T00:00:00Z'), '05 Jan 2026')
})
