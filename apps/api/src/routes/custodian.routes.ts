import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'

export const custodianRouter = Router()

custodianRouter.post('/api/v1/deposits', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createDeposit' })
})

custodianRouter.post('/api/v1/exits/:token_id', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createExit' })
})

custodianRouter.get('/api/v1/warehouse/:warehouse_id/inventory', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getWarehouseInventory' })
})
