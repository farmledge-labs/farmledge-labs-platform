import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import app from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { clearTokenFallback, seedTokenRecord } from '../src/lib/db.js';
import { stellarService } from '../src/services/stellar.service.js';

let server: Server;
let baseUrl: string;
const validToken = signToken({ sub: 'test-custodian', role: 'custodian' });
const token = {
  id: 'exit-token-row',
  tokenId: 'KN-EXIT-001',
  commodity: 'MAIZE_WHITE',
  grade: 'Grade_A',
  bagCount: 10,
  weightPerBagKg: 100,
  totalWeightKg: 1000,
  farmerId: 'farmer-1',
  warehouseId: 'warehouse-1',
  txHash: 'deposit-tx-001',
  stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/deposit-tx-001',
};

before(async () => {
  clearTokenFallback();
  seedTokenRecord(token);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('Expected TCP address');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  clearTokenFallback();
});

const request = () =>
  fetch(`${baseUrl}/api/v1/exits/${token.tokenId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ exit_reason: 'sold', delivery_note_number: 'DN-001' }),
  });

test('process exit returns the burned token data', async () => {
  const res = await request();
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.equal(body.data.token_id, token.tokenId);
  assert.equal(body.data.status, 'exited');
  assert.equal(body.data.tx_hash, '0x6275726e2d4b4e2d455849542d303031');
});

test('process exit returns the existing row for a duplicate transaction hash', async () => {
  const res = await request();
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'exited');
});

test('process exit does not write when Stellar burn fails', async () => {
  const originalBurn = stellarService.burn;
  stellarService.burn = async () => {
    throw new Error('Stellar unavailable');
  };
  try {
    const res = await request();
    assert.equal(res.status, 500);
  } finally {
    stellarService.burn = originalBurn;
  }
});
