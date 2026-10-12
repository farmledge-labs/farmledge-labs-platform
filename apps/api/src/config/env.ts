/**
 * src/config/env.ts
 *
 * Typed, fail-fast environment validation.
 *
 * Architecture
 * ────────────
 * parseEnv(raw)   — pure function; accepts a NodeJS.ProcessEnv-shaped object,
 *                   returns { ok: true, data } | { ok: false, errors: string[] }.
 *                   Never calls process.exit(), never logs.  Fully unit-testable.
 *
 * loadEnv()       — thin loader; calls parseEnv(process.env), prints every error
 *                   to stderr as "VARIABLE: reason", then process.exit(1).
 *                   In NODE_ENV=test it throws instead of exiting so Jest / the
 *                   Node test runner is not killed.
 *
 * env             — the validated, deeply-frozen result exported for the app.
 *
 * Security
 * ────────
 * Error messages are built from the Zod issue path + our own message text.
 * Zod's default "invalid_type" messages are stripped before surfacing; we never
 * echo the received value.  Custom refinements also only name the field.
 */

import { z } from 'zod'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Coerce an empty string to undefined so .optional() works as expected. */
const optionalStr = z.string().transform((v) => (v === '' ? undefined : v)).optional()

/** Non-empty string (trims whitespace). */
const requiredStr = z.string().min(1, 'must not be empty').trim()

// ─── Schema ───────────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  // ── Runtime ─────────────────────────────────────────────────────────────────
  /** 'development' | 'test' | 'production' */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** TCP port the Express server listens on. Default: 3000. */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ── Database ────────────────────────────────────────────────────────────────
  /** PostgreSQL connection string for the Prisma query engine. Required. */
  DATABASE_URL: requiredStr,

  /**
   * Direct connection URL (bypasses connection poolers like PgBouncer).
   * Required because the Prisma datasource declares directUrl = env("DIRECT_URL").
   * In local dev and Docker the value is typically the same as DATABASE_URL.
   */
  DIRECT_URL: requiredStr,

  // ── Auth ─────────────────────────────────────────────────────────────────────
  /**
   * HMAC-SHA256 secret used to sign JWTs.
   * Production rule: ≥ 32 characters and not a known placeholder.
   * Required.
   */
  JWT_SECRET: requiredStr,

  /**
   * JWT expiry duration string (e.g. "24h", "7d").
   * Optional – defaults to "24h" in jwt.ts when absent.
   * Feature: used by all JWT-issuing endpoints.
   */
  JWT_EXPIRES_IN: optionalStr,

  // ── Admin ────────────────────────────────────────────────────────────────────
  /**
   * Shared secret for admin-only endpoints (X-Admin-Secret header).
   * Required.
   */
  PLATFORM_ADMIN_SECRET: requiredStr,

  /**
   * Stellar public key of the platform admin account.
   * Optional – not yet consumed by any route (reserved for ADMIN-1).
   */
  ADMIN_PUBLIC_KEY: optionalStr,

  // ── Lender / API-key ─────────────────────────────────────────────────────────
  /**
   * HMAC salt prepended when hashing lender API keys.
   * Production rule: ≥ 16 characters and not a known placeholder.
   * Required.
   */
  LENDER_API_KEY_SALT: requiredStr,

  // ── Stellar ──────────────────────────────────────────────────────────────────
  /** 'testnet' | 'mainnet'. Required. */
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']),

  /** Horizon REST API base URL. Required. */
  HORIZON_URL: requiredStr.url('must be a valid URL'),

  /**
   * Optional Soroban RPC URL.
   * Optional – not yet consumed (reserved for STELLAR-2 Soroban integration).
   */
  STELLAR_RPC_URL: optionalStr,

  /**
   * Stellar network passphrase.
   * Optional – used by stellar-sdk when building transactions directly.
   * Reserved for STELLAR-2.
   */
  STELLAR_NETWORK_PASSPHRASE: optionalStr,

  /** Stellar secret key used to sign lock/unlock/mint transactions. Required. */
  STELLAR_PLATFORM_SECRET: requiredStr,

  /**
   * Soroban contract ID for the Maize commodity contract.
   * Optional – reserved for STELLAR-2.
   */
  MAIZE_CONTRACT_ID: optionalStr,

  /**
   * Soroban contract ID for the Sesame commodity contract.
   * Optional – reserved for STELLAR-2.
   */
  SESAME_CONTRACT_ID: optionalStr,

  // ── Farmer wallet encryption ─────────────────────────────────────────────────
  /**
   * Hex-encoded 32-byte AES-256 key used to encrypt farmer wallet private keys.
   * Must be exactly 64 hex characters (= 32 bytes) when present.
   * Optional now (no live code uses it yet) — will become required for STELLAR-3.
   * Production rule: reject known placeholder values.
   *
   * TODO: swap for HSM before mainnet (see STELLAR-3)
   */
  FARMER_WALLET_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === '' || /^[0-9a-fA-F]{64}$/.test(v),
      // IMPORTANT: never echo v — message must not contain the received value
      'FARMER_WALLET_ENCRYPTION_KEY: must be exactly 64 hex characters (32 bytes)',
    )
    .transform((v) => (v === '' ? undefined : v)),

  // ── S3 / object storage ──────────────────────────────────────────────────────
  /** S3 bucket name. Required. */
  S3_BUCKET: requiredStr,

  /** S3 region code (e.g. "us-east-1", or "auto" for Cloudflare R2). Required. */
  S3_REGION: requiredStr,

  /**
   * Custom endpoint URL (for Cloudflare R2, MinIO, localstack).
   * Optional – falls back to AWS default endpoint resolution.
   */
  S3_ENDPOINT: optionalStr,

  /**
   * Explicit AWS access key.
   * Optional – falls back to the default AWS credential chain.
   */
  S3_ACCESS_KEY_ID: optionalStr,

  /**
   * Explicit AWS secret access key.
   * Optional – falls back to the default AWS credential chain.
   */
  S3_SECRET_ACCESS_KEY: optionalStr,

  // ── CORS ────────────────────────────────────────────────────────────────────
  /**
   * Comma-separated list of allowed CORS origins in production.
   * Example: "https://app.farmledge.io,https://admin.farmledge.io"
   * Leave empty in dev/test — all origins are permitted there.
   */
  ALLOWED_ORIGINS: z.string().default(''),

  // ── Logging ──────────────────────────────────────────────────────────────────
  /**
   * Pino log level (trace|debug|info|warn|error|fatal).
   * Optional – defaults to "info".
   */
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .optional()
    .default('info'),

  // ── Redis ────────────────────────────────────────────────────────────────────
  /**
   * Redis connection URL.
   * Optional – only provisioned in Docker; not yet consumed (reserved for CACHE-1).
   * Example: "redis://redis:6379"
   */
  REDIS_URL: optionalStr,
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type Env = z.infer<typeof EnvSchema>

// ─── Production-only rules ────────────────────────────────────────────────────

/**
 * Values that are obviously placeholder secrets.  Any variable that equals one
 * of these in NODE_ENV=production triggers a validation error.
 * These are compared case-insensitively.
 *
 * IMPORTANT: do not add real secrets here.
 */
const SECRET_PLACEHOLDERS = new Set([
  'changeme',
  'change-me',
  'change-me-in-production',
  'secret',
  'supersecret',
  'password',
  'letmein',
  'placeholder',
  'local-development-jwt-secret',
  'local-development-api-key-salt',
  'local-development-admin-secret',
])

function isPlaceholder(value: string): boolean {
  return SECRET_PLACEHOLDERS.has(value.toLowerCase())
}

// Known safe dummy for .env.example  (64 hex zeros)
const EXAMPLE_ENCRYPTION_KEY = '0'.repeat(64)

function applyProductionRules(data: Env): string[] {
  const errors: string[] = []

  // JWT_SECRET: ≥ 32 chars and not a placeholder
  if (data.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET: must be at least 32 characters in production')
  }
  if (isPlaceholder(data.JWT_SECRET)) {
    errors.push('JWT_SECRET: must not be a placeholder value in production')
  }

  // PLATFORM_ADMIN_SECRET: not a placeholder
  if (isPlaceholder(data.PLATFORM_ADMIN_SECRET)) {
    errors.push('PLATFORM_ADMIN_SECRET: must not be a placeholder value in production')
  }

  // LENDER_API_KEY_SALT: ≥ 16 chars and not a placeholder
  if (data.LENDER_API_KEY_SALT.length < 16) {
    errors.push('LENDER_API_KEY_SALT: must be at least 16 characters in production')
  }
  if (isPlaceholder(data.LENDER_API_KEY_SALT)) {
    errors.push('LENDER_API_KEY_SALT: must not be a placeholder value in production')
  }

  // FARMER_WALLET_ENCRYPTION_KEY: not the .env.example dummy
  if (
    data.FARMER_WALLET_ENCRYPTION_KEY !== undefined &&
    data.FARMER_WALLET_ENCRYPTION_KEY === EXAMPLE_ENCRYPTION_KEY
  ) {
    errors.push(
      'FARMER_WALLET_ENCRYPTION_KEY: must not use the .env.example dummy value in production',
    )
  }

  return errors
}

// ─── Pure parseEnv ────────────────────────────────────────────────────────────

type ParseResult =
  | { ok: true; data: Env }
  | { ok: false; errors: string[] }

/**
 * Parse and validate a raw process.env-shaped object.
 *
 * Returns a discriminated union — never exits, never logs, never throws.
 * Safe to call from unit tests with arbitrary inputs.
 */
export function parseEnv(raw: NodeJS.ProcessEnv): ParseResult {
  const result = EnvSchema.safeParse(raw)

  if (!result.success) {
    // Build messages from path + our own text; never echo .received values.
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'unknown'
      // Use the issue message directly — our messages are already safe.
      // Zod's default messages never contain the received value for
      // z.string(), z.enum(), z.coerce.number() etc., but strip them for
      // invalid_type just to be safe.
      const message =
        issue.code === 'invalid_type' && issue.message.includes('received')
          ? `expected ${issue.expected}`
          : issue.message
      return `${path}: ${message}`
    })
    return { ok: false, errors }
  }

  // Apply production-only rules on top of schema validation
  if (result.data.NODE_ENV === 'production') {
    const prodErrors = applyProductionRules(result.data)
    if (prodErrors.length > 0) {
      return { ok: false, errors: prodErrors }
    }
  }

  return { ok: true, data: Object.freeze(result.data) as Env }
}

// ─── Mainnet HSM warning ──────────────────────────────────────────────────────

function warnIfMainnet(data: Env): void {
  if (data.STELLAR_NETWORK === 'mainnet') {
    // TODO: swap for HSM before mainnet (see STELLAR-3)
    console.warn(
      '[farmledge] WARNING: STELLAR_NETWORK=mainnet but env-based wallet keys are not HSM-backed. ' +
        'Swap STELLAR_PLATFORM_SECRET (and future FARMER_WALLET_ENCRYPTION_KEY) for an HSM-backed ' +
        'solution before handling real mainnet transactions. See STELLAR-3.',
    )
  }
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load, validate, and freeze the environment.
 *
 * Called once at module initialisation (below).  In NODE_ENV=test, throws
 * instead of calling process.exit(1) so the test runner is not killed.
 */
function loadEnv(): Env {
  const result = parseEnv(process.env)

  if (!result.ok) {
    const header = `\n[farmledge] Environment validation failed (${result.errors.length} error${result.errors.length === 1 ? '' : 's'}):\n`
    const body = result.errors.map((e) => `  ${e}`).join('\n')
    const message = `${header}${body}\n`

    if (process.env['NODE_ENV'] === 'test') {
      throw new Error(message)
    }

    process.stderr.write(message)
    process.exit(1)
  }

  warnIfMainnet(result.data)

  return result.data
}

// ─── Exported singleton ───────────────────────────────────────────────────────

export const env: Readonly<Env> = loadEnv()
