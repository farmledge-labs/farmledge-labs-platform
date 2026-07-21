import { z } from 'zod'

export const TransferSchema = z.object({
  recipient_id: z.string(),
  token_id: z.string(),
})