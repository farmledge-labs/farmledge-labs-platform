import { Commodity } from '@prisma/client'

export interface BagSizeEntry {
  /** Standard net weight per bag in kilograms */
  standardKg: number
  /** Whether a custodian may record a different weight per bag at intake */
  overrideAllowed: boolean
}

export const BAG_SIZE_CONFIG: Record<Commodity, BagSizeEntry> = {
  MAIZE_WHITE:  { standardKg: 100, overrideAllowed: true },
  MAIZE_YELLOW: { standardKg: 100, overrideAllowed: true },
  SESAME:       { standardKg: 80,  overrideAllowed: true },
}
