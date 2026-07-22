import { type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'

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
    next()
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
  }
}

/**
 * Stub API key guard for lender routes.
 *
 * Returns 401 if the `X-API-Key` header is missing or empty.
 * Validation against `LENDER_API_KEY_SALT` is intentionally out of
 * scope for this stub — a future PR will perform real verification
 * (constant-time compare against a hashed lender key).
 */
export const requireAPIKey = (req: Request, res: Response, next: NextFunction): void => {
  const rawApiKey = req.headers['x-api-key']
  // Headers may be sent as an array when the same header appears more
  // than once; normalize to the first value so `!apiKey` covers both
  // empty string and the (rare) empty-array case.
  const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey
  if (!apiKey) {
    res.status(401).json({ success: false, error: 'API key required' })
    return
  }
  next()
}
