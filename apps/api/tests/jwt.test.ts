import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../src/lib/jwt.js';
import { env } from '../src/config/env.js';
import { JWTPayload } from '@farmledge/shared';

test('sign produces a valid token', () => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: 'user-123',
    role: 'farmer',
  };
  const token = signToken(payload);
  
  // Verify using raw jsonwebtoken with the secret to prove it signed it correctly
  const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  assert.equal(decoded.sub, payload.sub);
  assert.equal(decoded.role, payload.role);
  assert.ok(decoded.iat);
  assert.ok(decoded.exp);
});

test('verify accepts a valid token', () => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: 'custodian-456',
    role: 'custodian',
  };
  const token = signToken(payload);
  const decoded = verifyToken(token);
  
  assert.equal(decoded.sub, payload.sub);
  assert.equal(decoded.role, payload.role);
});

test('verify rejects an expired token', () => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: 'expired-user',
    role: 'farmer',
  };
  // Sign a token with an expiration time in the past
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '-1s' });
  
  assert.throws(() => {
    verifyToken(token);
  }, /jwt expired/);
});

test('verify rejects a tampered token', () => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: 'valid-user',
    role: 'farmer',
  };
  const token = signToken(payload);
  const tamperedToken = token + 'tampered';
  
  assert.throws(() => {
    verifyToken(tamperedToken);
  });
});
