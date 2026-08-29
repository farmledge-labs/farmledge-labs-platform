import { Router } from 'express'
import { requireAPIKey } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { LockSchema, UnlockSchema } from '../schemas/lender.schemas.js'
import { getFarmerCollateral, lockToken, unlockToken } from '../controllers/lender.controller.js'

export const lenderRouter = Router()

lenderRouter.get('/farmers/:farmer_id/collateral', requireAPIKey, getFarmerCollateral)

// LEND-2 — real implementation
lenderRouter.get('/tokens/:token_id/verify', requireAPIKey, verifyTokenController)

lenderRouter.post('/tokens/:token_id/lock', requireAPIKey, validate(LockSchema), (req, res) => {
  return lockToken(req, res)
})

lenderRouter.post('/tokens/:token_id/unlock', requireAPIKey, validate(UnlockSchema), unlockToken)
