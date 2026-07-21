import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'
import * as custodianController from '../controllers/custodian.controller.js'

export const custodianRouter = Router()

custodianRouter.post('/api/v1/deposits', requireJWT, custodianController.createDeposit)
custodianRouter.post('/api/v1/exits/:token_id', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createExit' })
})

custodianRouter.get('/api/v1/warehouse/:warehouse_id/inventory', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getWarehouseInventory' })
})
