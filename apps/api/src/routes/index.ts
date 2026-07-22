import { Router } from 'express'
import { custodianRouter } from './custodian.routes.js'
import { farmerRouter } from './farmer.routes.js'
import { lenderRouter } from './lender.routes.js'
import { tokenRouter } from './token.routes.js'

export const router = Router()

router.use('/api/v1', custodianRouter)
router.use('/api/v1', farmerRouter)
router.use('/api/v1', tokenRouter)
router.use('/api/v1/lender', lenderRouter)

