import { z } from 'zod'

export const LockSchema = z.object({
  lender_id: z
    .string({ required_error: 'lender_id is required' })
    .min(1, 'lender_id is required'),
  loan_reference: z
    .string({ required_error: 'loan_reference is required' })
    .min(1, 'loan_reference is required'),
})

  export const UnlockSchema = LockSchema