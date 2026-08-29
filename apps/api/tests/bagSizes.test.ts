import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Commodity } from '@prisma/client'
import { BAG_SIZE_CONFIG } from '../src/config/bagSizes.js'

// Derive the set of known commodity values from the Prisma enum object at runtime
const allCommodities = Object.values(Commodity) as Commodity[]

test('BAG_SIZE_CONFIG — every Commodity enum value has a config entry', () => {
  for (const commodity of allCommodities) {
    const entry = BAG_SIZE_CONFIG[commodity]
    assert.ok(
      entry !== undefined,
      `Missing BAG_SIZE_CONFIG entry for Commodity.${commodity}`,
    )
    assert.equal(
      typeof entry.standardKg,
      'number',
      `standardKg must be a number for ${commodity}`,
    )
    assert.ok(
      entry.standardKg > 0,
      `standardKg must be positive for ${commodity}`,
    )
    assert.equal(
      typeof entry.overrideAllowed,
      'boolean',
      `overrideAllowed must be a boolean for ${commodity}`,
    )
  }
})

test('BAG_SIZE_CONFIG — no extra keys beyond declared Commodity values', () => {
  const configKeys = Object.keys(BAG_SIZE_CONFIG) as Commodity[]
  const enumSet = new Set(allCommodities)
  for (const key of configKeys) {
    assert.ok(
      enumSet.has(key),
      `BAG_SIZE_CONFIG has an unexpected key: "${key}" (not in Commodity enum)`,
    )
  }
  assert.equal(
    configKeys.length,
    allCommodities.length,
    `BAG_SIZE_CONFIG has ${configKeys.length} entries but Commodity enum has ${allCommodities.length} values`,
  )
})
