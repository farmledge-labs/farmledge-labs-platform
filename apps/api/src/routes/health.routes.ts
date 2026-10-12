/**
 * GET /health — liveness probe.
 *
 * Intentionally lightweight: no database, Redis, or Stellar calls.
 * This route is exempt from authentication and rate-limiting so that
 * container orchestrators (Docker healthcheck, Kubernetes liveness probe)
 * can poll it freely.
 *
 * Response: 200  { status: "ok", version: "0.1.0", service: "farmledge-api" }
 */

import { Router, type Request, type Response } from 'express'

export const healthRouter = Router()

healthRouter.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', version: '0.1.0', service: 'farmledge-api' })
})
