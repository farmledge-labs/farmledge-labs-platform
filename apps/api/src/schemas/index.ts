// Re-export all domain schemas from a single barrel so routes and tests
// can import from '@/schemas' rather than individual files.
export * from './custodian.schemas.js'
export * from './farmer.schemas.js'
export * from './lender.schemas.js'
export * from './upload.schemas.js'
export * from './auth.schemas.js'

import { z } from 'zod'

// TransferSchema is exported from farmer.schemas.js

// NOTE: LockSchema / UnlockSchema are defined (and exported) from
// lender.schemas.ts; the duplicate below has been removed to avoid
// a name clash when both files are re-exported.

export const SplitTokenSchema = z.object({
  split_amount_kg: z
    .number({ required_error: 'split_amount_kg is required' })
    .positive('split_amount_kg must be greater than 0'),
})
