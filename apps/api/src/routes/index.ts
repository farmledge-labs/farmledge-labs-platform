import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import { custodianRouter } from './custodian.routes.js'
import { farmerRouter } from './farmer.routes.js'
import { lenderRouter } from './lender.routes.js'
import { tokenRouter } from './token.routes.js'
import { uploadRouter } from './upload.routes.js'

export const router = Router()

router.use('/api/v1', adminRouter)
router.use('/api/v1', authRouter)
router.use('/api/v1', custodianRouter)
router.use('/api/v1', farmerRouter)
router.use('/api/v1', tokenRouter)
router.use('/api/v1', uploadRouter)
router.use('/api/v1/lender', lenderRouter)

