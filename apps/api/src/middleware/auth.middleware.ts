import { type Request, type Response, type NextFunction } from 'express'

export const requireJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  next()
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
