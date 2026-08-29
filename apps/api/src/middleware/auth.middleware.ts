import { createHash } from 'node:crypto'
import { type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'
import { db } from '../lib/db.js'
import { type RequestContext } from './logger.middleware.js'

export const requireJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  try {
    const payload = verifyToken(token)
    // Attach user payload to request for downstream handlers
    ;(req as any).user = payload
    ;(req as RequestContext).authContext = { actorId: payload.sub, actorRole: payload.role }
    next()
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
  }
}

function hashApiKey(apiKey: string): string {
  const salt = process.env.LENDER_API_KEY_SALT || 'change-me-in-production'
  return createHash('sha256').update(`${salt}:${apiKey}`).digest('hex')
}

export const requireAPIKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const rawApiKey = req.headers['x-api-key']
  // Headers may be sent as an array when the same header appears more
  // than once; normalize to the first value so `!apiKey` covers both
  // empty string and the (rare) empty-array case.
  const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey
  if (!apiKey) {
    res.status(401).json({ success: false, error: 'API key required' })
    return
  }

  try {
    const keyHash = hashApiKey(apiKey)
    const storedApiKey = await db.apiKey.findFirst({
      where: { keyHash },
      select: { id: true, lenderId: true, revokedAt: true },
    })

    if (!storedApiKey) {
      res.status(401).json({ success: false, error: 'Invalid API key' })
      return
    }

    if (storedApiKey.revokedAt) {
      res.status(401).json({ success: false, error: 'API key revoked' })
      return
    }

    await db.apiKey.update({
      where: { id: storedApiKey.id },
      data: { lastUsedAt: new Date() },
    })

    ;(req as RequestContext).authContext = { actorId: storedApiKey.lenderId, actorRole: 'lender' }

    next()
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to validate API key' })
  }
}
