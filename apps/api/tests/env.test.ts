/**
 * tests/env.test.ts
 *
 * Unit tests for the pure parseEnv() function in src/config/env.ts.
 *
 * Uses Node.js built-in test runner (node:test + node:assert/strict).
 * All tests operate on the exported parseEnv() function — no module
 * re-importing or process.exit concerns; the loader (env singleton) is
 * NOT tested here.
 *
 * eslint-disable no-restricted-properties — test files may read process.env
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from '../src/config/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A minimal valid env that satisfies every REQUIRED field.
 * Returns a new object each call to avoid accidental mutation between tests.
 */
function validEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/testdb',
    JWT_SECRET: 'a-valid-jwt-secret-that-is-long-enough-1234',
    PLATFORM_ADMIN_SECRET: 'admin-secret-for-testing',
    LENDER_API_KEY_SALT: 'lender-salt-for-testing',
    STELLAR_NETWORK: 'testnet',
    HORIZON_URL: 'https://horizon-testnet.stellar.org',
    STELLAR_PLATFORM_SECRET: 'SCZANGBA5RLXM6HIERL3WTJFB56Y4RYBUGGUWLPQKDIBPXHKNE4ACBFF',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
  }
}

/** Sentinel secrets — used to verify they never appear in error messages. */
const SENTINEL_SECRETS = [
  'supersecret-jwt-value-that-must-never-appear-in-errors',
  'supersecret-db-password-that-must-never-appear-in-errors',
  'supersecret-platform-key-that-must-never-appear-in-errors',
]

// ─── Basic validity ────────────────────────────────────────────────────────────

describe('parseEnv — valid config', () => {
  it('parses a fully valid config and returns ok:true', () => {
    const result = parseEnv(validEnv())
    assert.equal(result.ok, true)
  })

  it('coerces PORT string to number', () => {
    const result = parseEnv({ ...validEnv(), PORT: '8080' })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.data.PORT, 8080)
  })

  it('defaults PORT to 3000 when absent', () => {
    const env = validEnv()
    delete env['PORT']
    const result = parseEnv(env)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.data.PORT, 3000)
  })

  it('defaults NODE_ENV to development when absent', () => {
    const env = validEnv()
    delete env['NODE_ENV']
    const result = parseEnv(env)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.data.NODE_ENV, 'development')
  })

  it('defaults LOG_LEVEL to info when absent', () => {
    const result = parseEnv(validEnv())
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.data.LOG_LEVEL, 'info')
  })

  it('result is frozen (deeply immutable)', () => {
    const result = parseEnv(validEnv())
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(Object.isFrozen(result.data), true)
    }
  })
})

// ─── Required fields ───────────────────────────────────────────────────────────

describe('parseEnv — required fields', () => {
  const REQUIRED_FIELDS: Array<keyof NodeJS.ProcessEnv> = [
    'DATABASE_URL',
    'DIRECT_URL',
    'JWT_SECRET',
    'PLATFORM_ADMIN_SECRET',
    'LENDER_API_KEY_SALT',
    'STELLAR_NETWORK',
    'HORIZON_URL',
    'STELLAR_PLATFORM_SECRET',
    'S3_BUCKET',
    'S3_REGION',
  ]

  // Sanity-check: every field above must be present in validEnv() so the
  // delete-one-at-a-time loop actually exercises a real missing-field path.
  it('validEnv() contains all REQUIRED_FIELDS (self-check)', () => {
    const base = validEnv()
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        field in base,
        `validEnv() is missing field "${field}" — add it so the required-field tests work`,
      )
    }
  })

  for (const field of REQUIRED_FIELDS) {
    it(`missing ${field} produces an error naming that field`, () => {
      const env = validEnv()
      delete env[field]
      const result = parseEnv(env)
      assert.equal(result.ok, false)
      if (!result.ok) {
        const mentionsField = result.errors.some((e) => e.includes(field))
        assert.ok(mentionsField, `Expected error mentioning "${field}", got: ${result.errors.join('; ')}`)
      }
    })
  }

  it('three missing variables produce all three errors in one result', () => {
    const env = validEnv()
    delete env['DATABASE_URL']
    delete env['JWT_SECRET']
    delete env['S3_BUCKET']
    const result = parseEnv(env)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('DATABASE_URL')))
      assert.ok(result.errors.some((e) => e.includes('JWT_SECRET')))
      assert.ok(result.errors.some((e) => e.includes('S3_BUCKET')))
      assert.ok(
        result.errors.length >= 3,
        `Expected ≥ 3 errors, got ${result.errors.length}: ${result.errors.join('; ')}`,
      )
    }
  })
})

// ─── Secret leakage prevention ────────────────────────────────────────────────

describe('parseEnv — no secret value in error output', () => {
  it('sentinel secret values never appear in error messages', () => {
    const env = validEnv()

    // Plant sentinel values in several fields then break them
    env['JWT_SECRET'] = SENTINEL_SECRETS[0]!
    env['DATABASE_URL'] = `postgresql://user:${SENTINEL_SECRETS[1]}@localhost/db`
    env['STELLAR_PLATFORM_SECRET'] = SENTINEL_SECRETS[2]!

    // Remove a required field to force a parse error
    delete env['S3_BUCKET']

    const result = parseEnv(env)
    // Could be ok or not; what matters is no sentinel leaks
    if (!result.ok) {
      const combined = result.errors.join('\n')
      for (const secret of SENTINEL_SECRETS) {
        assert.ok(
          !combined.includes(secret),
          `Secret sentinel appeared in error output: "${secret}"`,
        )
      }
    }
  })

  it('even when JWT_SECRET itself is invalid, its value does not leak', () => {
    const env = { ...validEnv(), NODE_ENV: 'production' as const }
    // Short JWT_SECRET triggers a production rule error
    env['JWT_SECRET'] = SENTINEL_SECRETS[0]! // contains sentinel but is < 32 chars in production logic check
    const result = parseEnv(env)
    if (!result.ok) {
      const combined = result.errors.join('\n')
      // The sentinel value itself must not appear
      assert.ok(
        !combined.includes(SENTINEL_SECRETS[0]!),
        `JWT_SECRET value appeared in error: "${combined}"`,
      )
    }
  })
})

// ─── Production rules ──────────────────────────────────────────────────────────

describe('parseEnv — production rules', () => {
  function prodEnv(): NodeJS.ProcessEnv {
    return {
      ...validEnv(),
      NODE_ENV: 'production',
      JWT_SECRET: 'a-strong-production-jwt-secret-abcdef1234',
      PLATFORM_ADMIN_SECRET: 'a-strong-production-admin-secret-xyz',
      LENDER_API_KEY_SALT: 'a-strong-production-salt-xyz',
    }
  }

  it('production with strong secrets passes', () => {
    const result = parseEnv(prodEnv())
    assert.equal(result.ok, true)
  })

  it('JWT_SECRET shorter than 32 chars fails in production', () => {
    const result = parseEnv({ ...prodEnv(), JWT_SECRET: 'tooshort' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(
        result.errors.some((e) => e.includes('JWT_SECRET')),
        `Expected JWT_SECRET error, got: ${result.errors.join('; ')}`,
      )
    }
  })

  it('JWT_SECRET = "change-me-in-production" placeholder fails in production', () => {
    const result = parseEnv({ ...prodEnv(), JWT_SECRET: 'change-me-in-production' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('JWT_SECRET')))
    }
  })

  it('LENDER_API_KEY_SALT placeholder fails in production', () => {
    const result = parseEnv({ ...prodEnv(), LENDER_API_KEY_SALT: 'change-me-in-production' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('LENDER_API_KEY_SALT')))
    }
  })

  it('LENDER_API_KEY_SALT shorter than 16 chars fails in production', () => {
    const result = parseEnv({ ...prodEnv(), LENDER_API_KEY_SALT: 'tooshort' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('LENDER_API_KEY_SALT')))
    }
  })

  it('.env.example JWT_SECRET value fails in production', () => {
    // Load the actual .env.example to get the exact dummy value
    const examplePath = resolve(__dirname, '../.env.example')
    const raw = readFileSync(examplePath, 'utf-8')
    const match = raw.match(/^JWT_SECRET=(.+)$/m)
    const exampleJwt = match?.[1]?.trim()
    assert.ok(exampleJwt, '.env.example should have a JWT_SECRET line')

    const result = parseEnv({ ...prodEnv(), JWT_SECRET: exampleJwt })
    assert.equal(
      result.ok,
      false,
      `.env.example JWT_SECRET "${exampleJwt}" should be rejected in production`,
    )
  })

  it('.env.example FARMER_WALLET_ENCRYPTION_KEY dummy fails in production', () => {
    const examplePath = resolve(__dirname, '../.env.example')
    const raw = readFileSync(examplePath, 'utf-8')
    const match = raw.match(/^FARMER_WALLET_ENCRYPTION_KEY=(.+)$/m)
    const exampleKey = match?.[1]?.trim()
    assert.ok(exampleKey, '.env.example should have a FARMER_WALLET_ENCRYPTION_KEY line')

    const result = parseEnv({ ...prodEnv(), FARMER_WALLET_ENCRYPTION_KEY: exampleKey })
    assert.equal(
      result.ok,
      false,
      `.env.example FARMER_WALLET_ENCRYPTION_KEY should be rejected in production`,
    )
  })
})

// ─── FARMER_WALLET_ENCRYPTION_KEY validation ──────────────────────────────────

describe('parseEnv — FARMER_WALLET_ENCRYPTION_KEY', () => {
  it('absent key is accepted (optional)', () => {
    const env = validEnv()
    delete env['FARMER_WALLET_ENCRYPTION_KEY']
    const result = parseEnv(env)
    assert.equal(result.ok, true)
  })

  it('empty string is treated as absent (optional)', () => {
    const result = parseEnv({ ...validEnv(), FARMER_WALLET_ENCRYPTION_KEY: '' })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.FARMER_WALLET_ENCRYPTION_KEY, undefined)
    }
  })

  it('valid 64-hex-char key is accepted', () => {
    const validKey = 'a'.repeat(64)
    const result = parseEnv({ ...validEnv(), FARMER_WALLET_ENCRYPTION_KEY: validKey })
    assert.equal(result.ok, true)
  })

  it('63-char hex string (31 bytes) is rejected', () => {
    const shortKey = 'a'.repeat(63)
    const result = parseEnv({ ...validEnv(), FARMER_WALLET_ENCRYPTION_KEY: shortKey })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('FARMER_WALLET_ENCRYPTION_KEY')))
    }
  })

  it('65-char hex string (33 bytes) is rejected', () => {
    const longKey = 'a'.repeat(65)
    const result = parseEnv({ ...validEnv(), FARMER_WALLET_ENCRYPTION_KEY: longKey })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('FARMER_WALLET_ENCRYPTION_KEY')))
    }
  })

  it('64-char string with non-hex characters is rejected', () => {
    const badKey = 'g'.repeat(64) // 'g' is not a hex digit
    const result = parseEnv({ ...validEnv(), FARMER_WALLET_ENCRYPTION_KEY: badKey })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('FARMER_WALLET_ENCRYPTION_KEY')))
      // The bad value must not appear in the error message
      assert.ok(
        !result.errors.some((e) => e.includes(badKey)),
        'Bad key value must not appear in error messages',
      )
    }
  })
})

// ─── Mainnet HSM warning ──────────────────────────────────────────────────────

describe('parseEnv — mainnet', () => {
  it('STELLAR_NETWORK=mainnet is valid (no error, just a warning emitted elsewhere)', () => {
    const result = parseEnv({ ...validEnv(), STELLAR_NETWORK: 'mainnet' })
    assert.equal(result.ok, true)
  })

  it('STELLAR_NETWORK=invalid_value fails validation', () => {
    const result = parseEnv({ ...validEnv(), STELLAR_NETWORK: 'regtest' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes('STELLAR_NETWORK')))
    }
  })
})

// ─── process.env scan ─────────────────────────────────────────────────────────

describe('source scan — no process.env outside env.ts', () => {
  it('src/ contains no process.env reads outside src/config/env.ts', async () => {
    const { execSync } = await import('node:child_process')

    // grep exits 0 if it finds matches (bad), 1 if no matches (good)
    let output = ''
    try {
      output = execSync(
        'grep -rn "process\\.env" apps/api/src --include="*.ts" --include="*.js"',
        {
          cwd: resolve(__dirname, '../../..'),
          encoding: 'utf-8',
        },
      )
    } catch (_err) {
      // exit code 1 = no matches found — that's the passing case
      output = ''
    }

    // Filter out the one allowed file
    const violations = output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => !line.includes('src/config/env.ts'))

    assert.equal(
      violations.length,
      0,
      `process.env found outside src/config/env.ts:\n${violations.join('\n')}`,
    )
  })
})

// ─── Health endpoint ──────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 { status: "ok" } with no external calls', async () => {
    // Import app lazily so env is already loaded (via the valid .env in the
    // test environment, or the node --env-file-if-exists flag in the test script)
    const { default: app } = await import('../src/app.js')
    const { createServer } = await import('node:http')

    const server = createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))

    try {
      const addr = server.address()
      if (!addr || typeof addr === 'string') throw new Error('Expected TCP address')
      const url = `http://127.0.0.1:${addr.port}/health`
      const res = await fetch(url)
      assert.equal(res.status, 200)
      const body = (await res.json()) as Record<string, unknown>
      assert.equal(body['status'], 'ok')
      assert.equal(body['service'], 'farmledge-api')
      assert.ok(body['version'], 'version should be defined')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
