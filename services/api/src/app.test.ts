import { createExpenseCategorySchema } from '@credit-follow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from './app.js';
import { TEST_JWT_SECRET } from './test/helpers.js';
import { HttpError } from './errors/HttpError.js';
import { getValidated, validate } from './middleware/validate.js';

const listSchemas = {
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
};

const app = createApp({
  auth: { jwtSecret: TEST_JWT_SECRET },
  registerRoutes: (app) => {
    app.post('/test/categories', validate({ body: createExpenseCategorySchema }), (_req, res) => {
      res.status(201).json(res.locals.validated.body);
    });
    app.get('/test/list', validate(listSchemas), (_req, res) => {
      res.json(getValidated(res, listSchemas).query);
    });
    app.get('/test/forbidden', () => {
      throw HttpError.forbidden('No access');
    });
    app.get('/test/async-crash', async () => {
      throw new Error('secret internal detail');
    });
  },
});

describe('GET /health', () => {
  it('returns ok with the database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'disconnected' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('request validation', () => {
  it('accepts and normalizes a valid body', async () => {
    const res = await request(app).post('/test/categories').send({ name: '  מסעדות  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'מסעדות', kind: 'variable', monthlyBudgetMinor: 0 });
  });

  it('rejects an invalid body with details', async () => {
    const res = await request(app).post('/test/categories').send({ name: '', color: 'blue' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'body', path: 'name' }),
        expect.objectContaining({ location: 'body', path: 'color' }),
      ]),
    );
  });

  it('coerces and defaults query params', async () => {
    expect((await request(app).get('/test/list')).body).toEqual({ limit: 20 });
    expect((await request(app).get('/test/list?limit=5')).body).toEqual({ limit: 5 });
    expect((await request(app).get('/test/list?limit=500')).status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/test/categories')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('גוף הבקשה אינו JSON תקין');
  });
});

describe('error handling', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('maps HttpError to its status code', async () => {
    const res = await request(app).get('/test/forbidden');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'No access' } });
  });

  it('hides internal error details from async handlers', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const res = await request(app).get('/test/async-crash');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'אירעה שגיאה בשרת, נסו שוב מאוחר יותר' },
      });
    } finally {
      console.error = original;
    }
  });
});
