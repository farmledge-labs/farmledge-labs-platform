import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Response } from 'express';
import { ok, created, badRequest, unauthorized, notFound, serverError } from '../../src/utils/response.js';

interface MockResponse {
  statusCode: number;
  body: Record<string, unknown>;
  status: (code: number) => MockResponse;
  json: (data: Record<string, unknown>) => MockResponse;
}

test('Response helpers', async (t) => {
  const mockResponse = (): MockResponse => {
    const res = {} as MockResponse;
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: Record<string, unknown>) => {
      res.body = data;
      return res;
    };
    return res;
  };

  await t.test('ok helper', () => {
    const res = mockResponse();
    ok(res as unknown as Response, { foo: 'bar' }, 'Success');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, data: { foo: 'bar' }, message: 'Success' });
  });

  await t.test('created helper', () => {
    const res = mockResponse();
    created(res as unknown as Response, { id: 1 });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { success: true, data: { id: 1 } });
  });

  await t.test('badRequest helper', () => {
    const res = mockResponse();
    badRequest(res as unknown as Response, 'Invalid input');
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, error: 'Invalid input' });
  });

  await t.test('unauthorized helper', () => {
    const res = mockResponse();
    unauthorized(res as unknown as Response);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, error: 'Unauthorized' });
  });

  await t.test('notFound helper', () => {
    const res = mockResponse();
    notFound(res as unknown as Response, 'User not found');
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { success: false, error: 'User not found' });
  });

  await t.test('serverError helper', () => {
    const res = mockResponse();
    serverError(res as unknown as Response, 'Database failure');
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, error: 'Database failure' });
  });
});
