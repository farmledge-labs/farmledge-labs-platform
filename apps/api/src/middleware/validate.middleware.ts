import { type NextFunction, type Request, type Response } from 'express'
import { type ZodSchema, ZodError } from 'zod'

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join('; ')
        res.status(400).json({ success: false, error: message })
        return
      }

      next(error)
    }
  }
