import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { createTestApiKeyHeader } from './helpers/apiKey.js';

let server: Server;
let baseUrl: string;
let validApiKeyHeader: string;
const validToken = signToken({ sub: 'test-user', role: 'farmer' });

before(async () => {
  process.env.LENDER_API_KEY_SALT =
    process.env.LENDER_API_KEY_SALT || 'test-salt-key-minimum-32-characters-long';
  validApiKeyHeader = await createTestApiKeyHeader();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('Expected a TCP address from app.listen(0)');
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('POST /api/v1/deposits returns 200 stub response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/deposits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { success: true, data: 'STUB — createDeposit' });
});

test('POST /api/v1/exits/test-token returns not found for an unknown token', async () => {
  const res = await fetch(`${baseUrl}/api/v1/exits/test-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ exit_reason: 'sold', delivery_note_number: 'DN-001' }),
  });
  assert.equal(res.status, 404);
  const body = (await res.json()) as any;
  assert.equal(body.success, false);
});

test('GET /api/v1/warehouse/test-warehouse/inventory returns the warehouse inventory', async () => {
  const res = await fetch(`${baseUrl}/api/v1/warehouse/test-warehouse/inventory`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  // Query is filtered by warehouseId; with no DB connected in tests this is an empty list.
  assert.ok(Array.isArray(body.data));
});

test("GET /api/v1/farmers/test-farmer/tokens returns the authenticated farmer's tokens", async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/test-farmer/tokens`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  // Query is scoped to the JWT `sub`; with no DB connected in tests this is an empty list.
  assert.ok(Array.isArray(body.data));
});

test('GET /api/v1/farmers/:id/tokens without a JWT is rejected', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/test-farmer/tokens`);
  assert.equal(res.status, 401);
});

test('GET /api/v1/farmers/test-farmer/history returns farmer history', async () => {
  const res = await fetch(`${baseUrl}/api/v1/farmers/test-farmer/history`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test('POST /api/v1/transfers returns 200 with SDK transfer result', async () => {
  const res = await fetch(`${baseUrl}/api/v1/transfers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'KN-2026-000001', buyer_wallet_address: 'GABC...' }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.equal(body.data.token_id, 'KN-2026-000001');
  assert.equal(body.data.status, 'transferred');
  assert.equal(body.data.new_owner, 'GABC...');
  assert.ok(typeof body.data.tx_hash === 'string');
  assert.ok(typeof body.data.stellar_explorer_link === 'string');
});

test('GET /api/v1/certificates/test-token returns 200 PDF response', async () => {
  const res = await fetch(`${baseUrl}/api/v1/certificates/test-token`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /application\/pdf/);
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('GET /api/v1/lender/farmers/test-farmer/collateral returns calculated collateral', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/farmers/test-farmer/collateral`, {
    headers: { 'X-API-Key': validApiKeyHeader },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.equal(body.data.farmer_id, 'test-farmer');
  assert.equal(body.data.estimatedValueNgn, 0);
  assert.equal(body.data.price.source, 'placeholder');
  assert.ok(Array.isArray(body.data.tokens));
});

test('GET /api/v1/lender/tokens/test-token/verify returns 404 for unknown token (LEND-2 real controller)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/verify`, {
    headers: { 'X-API-Key': 'test-key' },
  })
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.ok(
    typeof body.error === 'string' && body.error.length > 0,
    'Expected a non-empty error message',
  )
})

test('POST /api/v1/lender/tokens/test-token/lock returns 404 for unknown token (LEND-3 real controller)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/lender/tokens/test-token/lock`, {
    method: 'POST',
    headers: { 'X-API-Key': validApiKeyHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lender_id: 'lender-1', loan_reference: 'LOAN-001' }),
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, 'Token not found');
});

test('POST /api/v1/tokens/:id/split returns 200 and split child token details', async () => {
  const res = await fetch(`${baseUrl}/api/v1/tokens/KN-2026-000042/split`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ split_amount_kg: 1500 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.parent_token_id, 'KN-2026-000042');
  assert.equal(body.data.status, 'exited');
  assert.equal(body.data.children.length, 2);
  assert.equal(body.data.children[0].token_id, 'KN-2026-000042-C1');
  assert.equal(body.data.children[0].total_weight_kg, 1500);
  assert.equal(body.data.children[0].parent_token_id, 'KN-2026-000042');
  assert.equal(body.data.children[1].token_id, 'KN-2026-000042-C2');
  assert.equal(body.data.children[1].total_weight_kg, 2500);
  assert.equal(body.data.children[1].parent_token_id, 'KN-2026-000042');
});
