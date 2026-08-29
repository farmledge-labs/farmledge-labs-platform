import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../lib/db.js'
import { type RequestContext } from './logger.middleware.js'

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!mutatingMethods.has(req.method)) {
    next()
    return
  }

  res.on('finish', () => {
    const context = req as RequestContext
    const actor = context.authContext
    if (!actor) return

    void db.auditLog.create({
      data: {
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: `${req.method} ${req.baseUrl}${req.path}`,
        targetId: req.params.id ?? req.params.token_id ?? null,
        metadata: {
          requestId: context.requestId,
          path: req.originalUrl,
          status: res.statusCode,
        },
      },
    }).catch((error: unknown) => {
      console.error('Failed to write audit log:', error)
    })
  })

  next()
}