import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/error.middleware.js';

test('Error middleware', async (t) => {
  const mockResponse = () => {
    const res: any = {};
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.body = data;
      return res;
    };
    return res as Response & { statusCode: number, body: any };
  };

  const req = {} as Request;
  const next = (() => {}) as NextFunction;

  await t.test('errorHandler returns 500 status', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {}; // suppress error logging for test
    errorHandler(new Error('Test error'), req, res, next);
    console.error = origError;

    assert.equal(res.statusCode, 500);
  });

  await t.test('errorHandler returns safe message', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {};
    errorHandler(new Error('Test error'), req, res, next);
    console.error = origError;

    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'Something went wrong');
  });

  await t.test('errorHandler masks stack trace', () => {
    const res = mockResponse();
    const origError = console.error;
    console.error = () => {};
    errorHandler(new Error('Secret stack details'), req, res, next);
    console.error = origError;

    assert.equal(res.body.stack, undefined);
  });
});
