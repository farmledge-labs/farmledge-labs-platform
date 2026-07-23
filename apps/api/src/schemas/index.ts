export * from './custodian.schemas.js'
export * from './farmer.schemas.js'
export * from './lender.schemas.js'
export * from './upload.schemas.js'
import { z } from 'zod'

export const TransferSchema = z.object({
  token_id: z
    .string({ required_error: 'token_id is required' })
    .min(1, 'token_id is required'),
  buyer_wallet_address: z
    .string({ required_error: 'buyer_wallet_address is required' })
    .min(1, 'buyer_wallet_address is required'),
})

export const LockSchema = z.object({
  lender_id: z
    .string({ required_error: 'lender_id is required' })
    .min(1, 'lender_id is required'),
  loan_reference: z
    .string({ required_error: 'loan_reference is required' })
    .min(1, 'loan_reference is required'),
})

export const SplitTokenSchema = z.object({
  split_amount_kg: z
    .number({ required_error: 'split_amount_kg is required' })
    .positive('split_amount_kg must be greater than 0'),
})

