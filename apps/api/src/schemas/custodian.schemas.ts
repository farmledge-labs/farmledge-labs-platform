import { Commodity } from '@prisma/client';
import { z } from 'zod';

const commodityValues = Object.values(Commodity) as [string, ...string[]];

export const DepositSchema = z.object({
  farmerId: z.string({ required_error: 'farmerId is required' }).min(1, 'farmerId is required'),
  commodity: z.enum(commodityValues, { required_error: 'commodity is required' }),
  grade: z.enum(['Grade A', 'Grade B', 'Grade C'], { required_error: 'grade is required' }),
  bagCount: z
    .number({ required_error: 'bagCount is required' })
    .int('bagCount must be a whole number')
    .positive('bagCount must be positive'),
  weightPerBagKg: z
    .number({ required_error: 'weightPerBagKg is required' })
    .positive('weightPerBagKg must be positive'),
  warehouseId: z.string({ required_error: 'warehouseId is required' }).min(1, 'warehouseId is required'),
  // Optional scale reading captured at intake. When present it is authoritative
  // for total weight; otherwise total weight is derived from the standard bag size.
  actualWeighedKg: z.number().positive('actualWeighedKg must be positive').optional(),
});

export const OnboardCustodianSchema = z
  .object({
    name: z.string({ required_error: 'name is required' }).min(1, 'name is required').max(120),
    location: z.string({ required_error: 'location is required' }).min(1, 'location is required').max(255),
    state: z.string({ required_error: 'state is required' }).min(1, 'state is required').max(100),
    certified: z.boolean().optional().default(false),
    // Accept either camelCase or snake_case for capacity
    capacityTonnes: z.number().positive('capacityTonnes must be positive').optional(),
    capacity_tonnes: z.number().positive('capacity_tonnes must be positive').optional(),
    // Accept either camelCase or snake_case (or legacy aliases) for wallet
    custodianWallet: z.string().min(1).optional(),
    custodian_wallet: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    walletAddress: z.string().min(1).optional(),
  })
  .refine(
    (d) =>
      (d.capacityTonnes !== undefined || d.capacity_tonnes !== undefined) &&
      (d.custodianWallet ?? d.custodian_wallet ?? d.address ?? d.walletAddress) !== undefined,
    { message: 'capacityTonnes (or capacity_tonnes) and custodianWallet are required' }
  );

/**
 * Schema for the optional request body of POST /admin/lenders/:id/api-keys.
 * Only the `label` field is accepted; everything else is stripped.
 */
export const GenerateApiKeySchema = z.object({
  label: z.string().min(1, 'label must not be empty').max(80, 'label must be ≤ 80 characters').optional(),
});

export const ExitSchema = z.object({
  exit_reason: z
    .string({ required_error: 'exit_reason is required' })
    .min(1, 'exit_reason is required')
    .max(500, 'exit_reason must be ≤ 500 characters'),
  delivery_note_number: z
    .string({ required_error: 'delivery_note_number is required' })
    .min(1, 'delivery_note_number is required')
    .max(100, 'delivery_note_number must be ≤ 100 characters'),
});
