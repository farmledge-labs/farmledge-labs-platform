import { S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'

/**
 * Singleton S3 client configured from environment variables.
 * Works with AWS S3 and Cloudflare R2 (S3-compatible).
 *
 * Required env vars:
 *   S3_BUCKET  — target bucket name
 *   S3_REGION  — AWS region (or "auto" for R2)
 *
 * Optional env vars:
 *   S3_ENDPOINT — custom endpoint URL (required for R2 / localstack)
 *   S3_ACCESS_KEY_ID     — access key (falls back to AWS credential chain)
 *   S3_SECRET_ACCESS_KEY — secret key (falls back to AWS credential chain)
 */

const globalForS3 = globalThis as unknown as {
  s3: S3Client | undefined
}

function createS3Client(): S3Client {
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region: env.S3_REGION,
  }

  // Custom endpoint for R2 / localstack / MinIO
  if (process.env.S3_ENDPOINT) {
    clientConfig.endpoint = process.env.S3_ENDPOINT
    // R2 requires path-style forcing
    clientConfig.forcePathStyle = true
  }

  // Explicit credentials — skip to use the default AWS credential chain
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
  }

  return new S3Client(clientConfig)
}

export const s3 = globalForS3.s3 ?? createS3Client()

if (process.env.NODE_ENV !== 'production') {
  globalForS3.s3 = s3
}

/** The configured bucket name, read once from env at startup. */
export const S3_BUCKET = env.S3_BUCKET
