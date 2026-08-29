import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { logger, type RequestContext } from './logger.middleware.js'

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req as Partial<RequestContext>).requestId ?? randomUUID()
  logger.error({ err, requestId }, 'request failed')
  if (typeof res.setHeader === 'function') res.setHeader('x-request-id', requestId)
  res.status(500).json({ success: false, error: 'Something went wrong', requestId })
}
