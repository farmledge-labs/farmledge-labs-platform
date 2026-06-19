import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'

export const farmerRouter = Router()

farmerRouter.get('/api/v1/farmers/:farmer_id/tokens', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerTokens' })
})

farmerRouter.get('/api/v1/farmers/:farmer_id/history', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerHistory' })
})

farmerRouter.post('/api/v1/transfers', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createTransfer' })
})

farmerRouter.get('/api/v1/certificates/:token_id', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getCertificate' })
})
