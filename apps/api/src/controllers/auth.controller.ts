import { type Request, type Response } from 'express'
import bcrypt from 'bcrypt'
import { db } from '../lib/db.js'
import { signToken } from '../lib/jwt.js'
import { ok, unauthorized, serverError } from '../utils/response.js'
import type { LoginBody } from '../schemas/auth.schemas.js'

/**
 * POST /api/v1/auth/login
 *
 * Authenticates a farmer using their phone number and 4-digit PIN.
 * Returns a signed JWT on success.
 *
 * Deliberately returns the same 401 for both "phone not found" and
 * "wrong PIN" to avoid leaking whether a phone number is registered.
 *
 * The request body is validated by LoginSchema via validate() middleware
 * in auth.routes.ts before this handler is reached. The cast to LoginBody
 * is therefore safe — both fields are guaranteed present and well-formed.
 */
export async function login(req: Request, res: Response): Promise<void> {
  // req.body has already been parsed and validated by validate(LoginSchema).
  const { phone, pin } = req.body as LoginBody

  try {
    const farmer = await db.farmer.findUnique({ where: { phone } })

    // Constant-time path: run bcrypt.compare even on a dummy hash when the
    // farmer is not found so response timing does not reveal valid phones.
    const dummyHash = '$2b$10$invalidhashpadding000000000000000000000000000000000000'
    const hashToCompare = farmer?.pinHash ?? dummyHash

    const pinMatch = await bcrypt.compare(pin, hashToCompare)

    if (!farmer || !farmer.pinHash || !pinMatch) {
      unauthorized(res)
      return
    }

    const token = signToken({ sub: farmer.id, role: 'farmer' })

    ok(res, { token, farmerId: farmer.id })
  } catch (err) {
    serverError(res, 'Login failed')
  }
}
