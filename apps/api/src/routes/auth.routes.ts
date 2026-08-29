import { Router } from 'express'
import { validate } from '../middleware/validate.middleware.js'
import { LoginSchema } from '../schemas/auth.schemas.js'
import { login } from '../controllers/auth.controller.js'

export const authRouter = Router()

authRouter.post('/auth/login', validate(LoginSchema), login)
