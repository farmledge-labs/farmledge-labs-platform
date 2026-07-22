import { Commodity } from '@prisma/client'
import { z } from 'zod'

const commodityValues = Object.values(Commodity) as [string, ...string[]]

export const DepositSchema = z.object({
  farmerId: z.string({ required_error: 'farmerId is required' }),
  commodity: z.enum(commodityValues),
  grade: z.enum(['Grade A', 'Grade B', 'Grade C']),
  bagCount: z.number({ required_error: 'bagCount is required' }).int().positive(),
  weightPerBagKg: z.number({ required_error: 'weightPerBagKg is required' }).positive(),
  warehouseId: z.string({ required_error: 'warehouseId is required' }),
})