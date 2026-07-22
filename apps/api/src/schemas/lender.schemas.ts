import { z } from 'zod'

export const LockSchema = z.object({
  lender_id: z.string(),
  loan_reference: z.string(),
})