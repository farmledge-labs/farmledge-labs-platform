import { z } from 'zod'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/json',
]

export const PresignUploadSchema = z.object({
  fileName: z
    .string({ required_error: 'fileName is required' })
    .min(1, 'fileName is required')
    .max(255, 'fileName must be at most 255 characters'),
  contentType: z
    .string({ required_error: 'contentType is required' })
    .refine((val) => ALLOWED_CONTENT_TYPES.includes(val), {
      message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
})
