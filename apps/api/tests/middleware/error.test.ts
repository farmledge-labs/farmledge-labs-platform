import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/error.middleware.js';

interface MockResponse {
  statusCode: number;
  body: Record<string, unknown>;
  status: (code: number) => MockResponse;
  json: (data: Record<string, unknown>) => MockResponse;
}

test('Error middleware', async (t) => {
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
    return res as MockResponse & Response;
  };

  const req = {} as Request;
  const next = (() => {}) as NextFunction;

  await t.test('errorHandler returns 500 status', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {}; // suppress error logging for test
    errorHandler(new Error('Test error'), req, res as unknown as Response, next);
    console.error = origError;

    assert.equal(res.statusCode, 500);
  });

  await t.test('errorHandler returns safe message', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {};
    errorHandler(new Error('Test error'), req, res as unknown as Response, next);
    console.error = origError;

    assert.equal(res.body['success'], false);
    assert.equal(res.body['error'], 'Something went wrong');
  });

  await t.test('errorHandler masks stack trace', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {};
    errorHandler(new Error('Secret stack details'), req, res as unknown as Response, next);
    console.error = origError;

    assert.equal(res.body['stack'], undefined);
  });
});
