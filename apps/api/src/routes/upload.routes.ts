import { Router } from 'express'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'node:crypto'
import path from 'node:path'
import { requireJWT } from '../middleware/auth.middleware.js'
import { validate } from '../middleware/validate.middleware.js'
import { PresignUploadSchema } from '../schemas/index.js'
import { s3, S3_BUCKET } from '../lib/s3.js'
import { ok, badRequest, serverError } from '../utils/response.js'
import type { Request, Response } from 'express'

export const uploadRouter = Router()

uploadRouter.post(
  '/uploads/presign',
  requireJWT,
  validate(PresignUploadSchema),
  async (req: Request, res: Response) => {
    try {
      const { fileName, contentType } = req.body as {
        fileName: string
        contentType: string
      }

      const safeName = path.basename(fileName)
      const key = `uploads/${crypto.randomUUID()}/${safeName}`

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: contentType,
      })

      const url = await getSignedUrl(s3, command, { expiresIn: 300 })

      ok(res, { url, key })
    } catch (err) {
      serverError(res, 'Failed to generate presigned upload URL')
    }
  },
)
