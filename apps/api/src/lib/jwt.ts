import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { JWTPayload } from '@farmledge/shared';

/**
 * Cryptographically signs a payload into a JWT.
 */
export function signToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'> & Partial<Pick<JWTPayload, 'iat' | 'exp'>>
): string {
  const options: jwt.SignOptions = {};
  if (!payload.exp) {
    options.expiresIn = '24h';
  }
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Cryptographically verifies a JWT and returns the parsed payload.
 * Throws an error if the token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
}
