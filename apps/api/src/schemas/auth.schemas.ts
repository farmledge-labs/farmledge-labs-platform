import { z } from 'zod'

export const LoginSchema = z.object({
  phone: z.string().min(1, 'phone is required'),
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must be 4 numeric digits'),
})

export type LoginBody = z.infer<typeof LoginSchema>
