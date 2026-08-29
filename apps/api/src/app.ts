import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { router } from './routes/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { requestLogger } from './middleware/logger.middleware.js'
import { auditMiddleware } from './middleware/audit.middleware.js'

const app = express()

// ─── CORS ────────────────────────────────────────────────────────────────────
// In production: only accept requests from explicitly listed origins.
// In development / test: allow all origins so local frontends work without config.
const ALLOWED_ORIGINS_PROD = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const corsOptions: cors.CorsOptions = {
  origin:
    env.NODE_ENV === 'production'
      ? (origin, callback) => {
          // Allow server-to-server calls (no Origin header) only in staging/internal.
          // For a public API you may want to reject requests with no origin header.
          if (!origin || ALLOWED_ORIGINS_PROD.includes(origin)) {
            callback(null, true)
          } else {
            callback(new Error(`CORS: origin '${origin}' is not allowed`))
          }
        }
      : true, // dev/test – wide open
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Admin-Secret'],
  // Do NOT expose X-Admin-Secret in responses
  exposedHeaders: [],
  credentials: true,
  maxAge: 86_400, // 24 h pre-flight cache
}

app.use(cors(corsOptions))

// ─── Helmet (security headers) ───────────────────────────────────────────────
// We override the defaults where they need to be tighter.
app.use(
  helmet({
    // Content-Security-Policy: this is a pure JSON API, not a browser app.
    // Deny framing and restrict sources to 'none' / 'self' as appropriate.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        // Only allow HTTPS in production; relax for localhost in dev/test
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // HSTS: 1 year, include subdomains, eligible for preload list.
    // Only sent over HTTPS; Helmet suppresses it automatically on HTTP.
    strictTransportSecurity: {
      maxAge: 31_536_000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Prevent click-jacking (belt-and-suspenders with CSP frameAncestors)
    frameguard: { action: 'deny' },
    // Disable the legacy X-XSS-Protection header (CSP is the modern replacement)
    xssFilter: false,
    // Hide the X-Powered-By: Express header
    hidePoweredBy: true,
    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // Referrer-Policy: send only origin for cross-origin requests
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Permissions-Policy: disable browser features the API doesn't need
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    originAgentCluster: true,
  })
)

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Cap request bodies at 100 kb to limit memory amplification attacks.
app.use(express.json({ limit: '100kb' }))

// ─── Health check (intentionally before auth middleware) ─────────────────────
app.use(requestLogger)
app.use(express.json())
app.use(auditMiddleware)
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok', version: '0.1.0', service: 'farmledge-api' })
})

// ─── API routes ───────────────────────────────────────────────────────────────
app.use(router)

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler)

export default app
