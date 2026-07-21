import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { TransferSchema } from '../schemas/index.js'

export const farmerRouter = Router()

farmerRouter.get('/farmers/:farmer_id/tokens', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerTokens' })
})

farmerRouter.get('/farmers/:farmer_id/history', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerHistory' })
})

farmerRouter.post('/transfers', requireJWT, validate(TransferSchema), (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createTransfer' })
})

farmerRouter.get('/certificates/:token_id', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getCertificate' })
})
