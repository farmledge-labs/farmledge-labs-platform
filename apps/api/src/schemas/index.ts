import { z } from 'zod'

const requiredString = (fieldName: string) =>
  z
    .string({
      required_error: `${fieldName} is required`,
      invalid_type_error: `${fieldName} is required`,
    })
    .min(1, `${fieldName} is required`)

export const TransferSchema = z.object({
  token_id: requiredString('token_id'),
  buyer_wallet_address: requiredString('buyer_wallet_address'),
})

export const LockSchema = z.object({
  lender_id: requiredString('lender_id'),
  loan_reference: requiredString('loan_reference'),
})
