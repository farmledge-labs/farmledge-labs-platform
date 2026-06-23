import { type Request, type Response, type NextFunction } from 'express'
import { type ZodSchema } from 'zod'

/**
 * Body-validation middleware factory.
 *
 * Parses `req.body` against the supplied Zod schema. On failure it responds
 * with `400` and a human-readable error message (the schema's own messages,
 * joined) rather than Zod's verbose default output. On success the parsed
 * (and stripped) value replaces `req.body` before handing off to the handler.
 */
export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const error = result.error.issues.map((issue) => issue.message).join(', ')
      res.status(400).json({ success: false, error })
      return
    }
    req.body = result.data
    next()
  }
