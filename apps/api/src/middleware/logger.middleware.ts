import { randomUUID } from 'node:crypto'
import pino from 'pino'
import { type Request, type Response, type NextFunction } from 'express'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})

export type RequestContext = Request & {
  requestId: string
  authContext?: {
    actorId: string
    actorRole: string
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || randomUUID()
  ;(req as RequestContext).requestId = requestId
  res.setHeader('x-request-id', requestId)
  const startedAt = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    logger.info({
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    }, 'request completed')
  })

  next()
}