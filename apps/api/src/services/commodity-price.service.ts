/**
 * Commodity Price Service — the single source of NGN per-kg prices.
 *
 * Design decisions:
 *  - Static table keyed by (Commodity, Grade).  A future PR can swap this
 *    for a live AFEX / WCX market-data feed without changing any callers.
 *  - Prices are in whole NGN (no decimals) to avoid floating-point drift.
 *    All arithmetic using these values should stay in integers until the
 *    final JSON serialisation.
 *  - Every commodity × grade combination is represented so callers can
 *    always get a price without a null-check.
 *
 * This is the ONLY place in the codebase that should define commodity
 * prices in NGN.  LEND-1 (collateral summary) and LEND-2 (token verify)
 * both import from here.
 *
 * Price references (approximate Aug 2026 AFEX indicative prices, NGN/kg):
 *   Maize White  Grade A: 750  Grade B: 680  Grade C: 590
 *   Maize Yellow Grade A: 720  Grade B: 650  Grade C: 560
 *   Sesame       Grade A: 3800 Grade B: 3400 Grade C: 2900
 */

import { Commodity, Grade } from '@prisma/client'

/** NGN price per kilogram for a commodity + grade combination. */
export interface CommodityPrice {
  /** Commodity enum value */
  commodity: Commodity
  /** Grade enum value */
  grade: Grade
  /** Whole NGN per kilogram (integer) */
  pricePerKgNgn: number
}

/**
 * Lookup table: [Commodity][Grade] → NGN per kg.
 *
 * Structured as a nested Record so TypeScript exhaustiveness can be enforced
 * at compile time when new commodities or grades are added.
 */
const PRICE_TABLE: Record<Commodity, Record<Grade, number>> = {
  [Commodity.MAIZE_WHITE]: {
    [Grade.Grade_A]: 750,
    [Grade.Grade_B]: 680,
    [Grade.Grade_C]: 590,
  },
  [Commodity.MAIZE_YELLOW]: {
    [Grade.Grade_A]: 720,
    [Grade.Grade_B]: 650,
    [Grade.Grade_C]: 560,
  },
  [Commodity.SESAME]: {
    [Grade.Grade_A]: 3800,
    [Grade.Grade_B]: 3400,
    [Grade.Grade_C]: 2900,
  },
}

/**
 * Return the NGN price per kilogram for the given commodity and grade.
 *
 * Throws if the combination is not in the table — this should never happen
 * in production because Prisma enums are exhaustive, but it surfaces data
 * inconsistencies loudly during development.
 */
export function getPricePerKgNgn(commodity: Commodity, grade: Grade): number {
  const gradeMap = PRICE_TABLE[commodity]
  if (!gradeMap) {
    throw new Error(`No price data for commodity: ${commodity}`)
  }
  const price = gradeMap[grade]
  if (price === undefined) {
    throw new Error(`No price data for commodity ${commodity} grade ${grade}`)
  }
  return price
}

/**
 * Compute the estimated NGN value of a given weight of commodity/grade.
 *
 * @param commodity  Prisma Commodity enum
 * @param grade      Prisma Grade enum
 * @param weightKg   Total weight in kilograms (integer expected)
 * @returns          Estimated value in whole NGN (integer)
 */
export function estimateValueNgn(
  commodity: Commodity,
  grade: Grade,
  weightKg: number,
): number {
  return getPricePerKgNgn(commodity, grade) * weightKg
}

/**
 * Return all price entries — useful for LEND-1 collateral summaries that
 * need to enumerate price assumptions in the response.
 */
export function getAllPrices(): CommodityPrice[] {
  return (Object.keys(PRICE_TABLE) as Commodity[]).flatMap((commodity) =>
    (Object.keys(PRICE_TABLE[commodity]) as Grade[]).map((grade) => ({
      commodity,
      grade,
      pricePerKgNgn: PRICE_TABLE[commodity][grade],
    })),
  )
}
