import { Router } from 'express'
import { requireAPIKey } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { LockSchema } from '../schemas/index.js'
import { verifyTokenController } from '../controllers/lender/verify-token.controller.js'

export const lenderRouter = Router()

lenderRouter.get('/farmers/:farmer_id/collateral', requireAPIKey, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — GET /api/v1/lender/farmers/:farmer_id/collateral' })
})

// LEND-2 — real implementation
lenderRouter.get('/tokens/:token_id/verify', requireAPIKey, verifyTokenController)

lenderRouter.post('/tokens/:token_id/lock', requireAPIKey, validate(LockSchema), (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — POST /api/v1/lender/tokens/:token_id/lock' })
})
