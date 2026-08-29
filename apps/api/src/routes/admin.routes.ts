import { Router } from 'express'
import { generateApiKey, onboardCustodian } from '../controllers/admin.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { GenerateApiKeySchema, OnboardCustodianSchema } from '../schemas/index.js'

export const adminRouter = Router()

/**
 * POST /api/v1/admin/lenders/:id/api-keys
 *
 * Generates a new API key for the given lender.
 * Requires the X-Admin-Secret header to match PLATFORM_ADMIN_SECRET.
 * Authentication is handled inside the controller so error messages
 * are consistent with the rest of the API response shape.
 *
 * Body: optional { label?: string }
 */
adminRouter.post('/admin/lenders/:id/api-keys', validate(GenerateApiKeySchema), generateApiKey)

/**
 * POST /api/v1/admin/custodians
 *
 * Onboards a new custodian by calling SDK add_custodian() on-chain
 * and creating the DB record in the same request.
 * Requires the X-Admin-Secret header to match PLATFORM_ADMIN_SECRET.
 *
 * Body: { name, location, state, certified?, capacityTonnes, custodianWallet }
 */
adminRouter.post('/admin/custodians', validate(OnboardCustodianSchema), onboardCustodian)
