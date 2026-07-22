import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { DepositSchema } from '../schemas/index.js'
import { createDeposit } from './custodian.controller.js'

export const custodianRouter = Router()

custodianRouter.post('/deposits', requireJWT, validate(DepositSchema), createDeposit)

custodianRouter.post('/exits/:token_id', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — createExit' })
})

custodianRouter.get('/warehouse/:warehouse_id/inventory', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getWarehouseInventory' })
})
