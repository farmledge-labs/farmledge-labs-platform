import { Router } from 'express'
import { requireAPIKey } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { LockSchema } from '../schemas/index.js'

export const lenderRouter = Router()

lenderRouter.get('/farmers/:farmer_id/collateral', requireAPIKey, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — GET /api/v1/lender/farmers/:farmer_id/collateral' })
})

lenderRouter.get('/tokens/:token_id/verify', requireAPIKey, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — GET /api/v1/lender/tokens/:token_id/verify' })
})

lenderRouter.post('/tokens/:token_id/lock', requireAPIKey, validate(LockSchema), (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — POST /api/v1/lender/tokens/:token_id/lock' })
})
