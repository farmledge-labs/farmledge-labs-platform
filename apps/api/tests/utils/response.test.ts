import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Response } from 'express';
import { ok, created, badRequest, unauthorized, notFound, serverError } from '../../src/utils/response.js';

test('Response helpers', async (t) => {
  const mockResponse = () => {
    const res: Partial<Response> & { statusCode: number; body: unknown } = {
      status(code: number) {
        this.statusCode = code;
        return this as Response;
      },
      json(data: unknown) {
        this.body = data;
        return this as Response;
      },
      statusCode: 0,
      body: undefined,
    };
    return res as Response & { statusCode: number; body: unknown };
  };

  await t.test('ok helper', () => {
    const res = mockResponse();
    ok(res, { foo: 'bar' }, 'Success');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, data: { foo: 'bar' }, message: 'Success' });
  });

  await t.test('created helper', () => {
    const res = mockResponse();
    created(res, { id: 1 });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { success: true, data: { id: 1 } });
  });

  await t.test('badRequest helper', () => {
    const res = mockResponse();
    badRequest(res, 'Invalid input');
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, error: 'Invalid input' });
  });

  await t.test('unauthorized helper', () => {
    const res = mockResponse();
    unauthorized(res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, error: 'Unauthorized' });
  });

  await t.test('notFound helper', () => {
    const res = mockResponse();
    notFound(res, 'User not found');
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { success: false, error: 'User not found' });
  });

  await t.test('serverError helper', () => {
    const res = mockResponse();
    serverError(res, 'Database failure');
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, error: 'Database failure' });
  });
});
