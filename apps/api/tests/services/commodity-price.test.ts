/**
 * tests/services/commodity-price.test.ts
 *
 * Unit tests for commodity-price.service.ts
 * No I/O — all tests are pure computation.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Commodity, Grade } from '@prisma/client'
import {
  getPricePerKgNgn,
  estimateValueNgn,
  getAllPrices,
} from '../../src/services/commodity-price.service.js'

describe('getPricePerKgNgn', () => {
  test('returns a positive integer for every commodity × grade combination', () => {
    const commodities = Object.values(Commodity)
    const grades = Object.values(Grade)

    for (const commodity of commodities) {
      for (const grade of grades) {
        const price = getPricePerKgNgn(commodity, grade)
        assert.ok(Number.isInteger(price), `Expected integer price for ${commodity}/${grade}`)
        assert.ok(price > 0, `Expected positive price for ${commodity}/${grade}`)
      }
    }
  })

  test('Grade_A prices are higher than Grade_B for the same commodity', () => {
    for (const commodity of Object.values(Commodity)) {
      const priceA = getPricePerKgNgn(commodity, Grade.Grade_A)
      const priceB = getPricePerKgNgn(commodity, Grade.Grade_B)
      assert.ok(
        priceA > priceB,
        `Expected Grade_A (${priceA}) > Grade_B (${priceB}) for ${commodity}`,
      )
    }
  })

  test('Grade_B prices are higher than Grade_C for the same commodity', () => {
    for (const commodity of Object.values(Commodity)) {
      const priceB = getPricePerKgNgn(commodity, Grade.Grade_B)
      const priceC = getPricePerKgNgn(commodity, Grade.Grade_C)
      assert.ok(
        priceB > priceC,
        `Expected Grade_B (${priceB}) > Grade_C (${priceC}) for ${commodity}`,
      )
    }
  })

  test('Sesame Grade_A price is higher than Maize White Grade_A (premium commodity)', () => {
    const sesameA = getPricePerKgNgn(Commodity.SESAME, Grade.Grade_A)
    const maizeA = getPricePerKgNgn(Commodity.MAIZE_WHITE, Grade.Grade_A)
    assert.ok(
      sesameA > maizeA,
      `Expected Sesame (${sesameA}) > Maize White (${maizeA}) at Grade_A`,
    )
  })

  test('specific price: MAIZE_WHITE Grade_A = 750 NGN/kg', () => {
    assert.equal(getPricePerKgNgn(Commodity.MAIZE_WHITE, Grade.Grade_A), 750)
  })

  test('specific price: SESAME Grade_A = 3800 NGN/kg', () => {
    assert.equal(getPricePerKgNgn(Commodity.SESAME, Grade.Grade_A), 3800)
  })

  test('specific price: MAIZE_YELLOW Grade_C = 560 NGN/kg', () => {
    assert.equal(getPricePerKgNgn(Commodity.MAIZE_YELLOW, Grade.Grade_C), 560)
  })
})

describe('estimateValueNgn', () => {
  test('returns pricePerKg × weightKg', () => {
    // MAIZE_WHITE Grade_A at 750 NGN/kg × 4000 kg = 3,000,000 NGN
    const result = estimateValueNgn(Commodity.MAIZE_WHITE, Grade.Grade_A, 4000)
    assert.equal(result, 3_000_000)
  })

  test('returns 0 when weightKg is 0', () => {
    const result = estimateValueNgn(Commodity.SESAME, Grade.Grade_A, 0)
    assert.equal(result, 0)
  })

  test('result is an integer', () => {
    const result = estimateValueNgn(Commodity.MAIZE_YELLOW, Grade.Grade_B, 2400)
    assert.ok(Number.isInteger(result))
    assert.equal(result, 650 * 2400) // 1,560,000
  })

  test('SESAME Grade_A 1000 kg = 3,800,000 NGN', () => {
    assert.equal(estimateValueNgn(Commodity.SESAME, Grade.Grade_A, 1000), 3_800_000)
  })
})

describe('getAllPrices', () => {
  test('returns one entry for every commodity × grade combination', () => {
    const prices = getAllPrices()
    const commodities = Object.values(Commodity)
    const grades = Object.values(Grade)
    assert.equal(prices.length, commodities.length * grades.length)
  })

  test('every entry has commodity, grade, and positive integer pricePerKgNgn', () => {
    for (const entry of getAllPrices()) {
      assert.ok(entry.commodity, 'commodity must be set')
      assert.ok(entry.grade, 'grade must be set')
      assert.ok(Number.isInteger(entry.pricePerKgNgn), 'price must be integer')
      assert.ok(entry.pricePerKgNgn > 0, 'price must be positive')
    }
  })

  test('no duplicate commodity × grade pairs', () => {
    const prices = getAllPrices()
    const keys = prices.map((p) => `${p.commodity}:${p.grade}`)
    const unique = new Set(keys)
    assert.equal(unique.size, prices.length, 'Expected no duplicate commodity/grade pairs')
  })
})
