import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatWeight,
  formatBags,
  formatCommodity,
  formatTokenId,
  formatDate,
} from '../../src/utils/formatters.js'

test('formatWeight formats a whole-number kg amount with thousands separators', () => {
  assert.equal(formatWeight(4000), '4,000 kg')
})

test('formatWeight handles small values without separators', () => {
  assert.equal(formatWeight(50), '50 kg')
})

test('formatBags formats bag count and per-bag weight', () => {
  assert.equal(formatBags(40, 100), '40 × 100kg bags')
})

test('formatBags formats large bag counts with thousands separators', () => {
  assert.equal(formatBags(1200, 50), '1,200 × 50kg bags')
})

test('formatCommodity maps a known commodity code to its display label', () => {
  assert.equal(formatCommodity('MAIZE_WHITE'), 'White Maize')
})

test('formatCommodity falls back to title case for an unknown commodity code', () => {
  assert.equal(formatCommodity('PALM_OIL'), 'Palm Oil')
})

test('formatTokenId upper-cases a lower-case token id', () => {
  assert.equal(formatTokenId('kn-2026-000042'), 'KN-2026-000042')
})

test('formatTokenId leaves an already upper-cased token id unchanged', () => {
  assert.equal(formatTokenId('KN-2026-000042'), 'KN-2026-000042')
})

test('formatDate formats an ISO timestamp as "DD Mon YYYY"', () => {
  assert.equal(formatDate('2026-03-14T00:00:00Z'), '14 Mar 2026')
})

test('formatDate uses UTC so a late-day timestamp keeps the same calendar date', () => {
  assert.equal(formatDate('2026-12-31T23:59:59Z'), '31 Dec 2026')
})