import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { requestIdMiddleware } from '../middlewares/requestId.js';
import { errorHandlerMiddleware } from '../middlewares/errorHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { z } from 'zod';

describe('Consistent API Response & Error Handling', () => {
  function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);

    app.get('/test/success', (_req: Request, res: Response) => {
      sendSuccess(res, { message: 'operational' });
    });

    app.get('/test/custom-error', () => {
      throw new ValidationError('Invalid system parameters', [
        { field: 'slug', message: 'required' },
      ]);
    });

    app.get('/test/not-found', () => {
      throw new NotFoundError('System', '999');
    });

    app.get('/test/conflict', () => {
      throw new ConflictError('System with this slug already exists');
    });

    app.post('/test/zod-validation', (req: Request) => {
      const schema = z.object({
        name: z.string().min(3),
        port: z.number().int().positive(),
      });
      schema.parse(req.body);
    });

    app.use(errorHandlerMiddleware);
    return app;
  }

  const app = createTestApp();

  it('formats success responses with standard envelope and meta', async () => {
    const res = await request(app).get('/test/success');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ message: 'operational' });
    expect(res.body.meta).toHaveProperty('timestamp');
    expect(res.body.meta).toHaveProperty('requestId');
  });

  it('formats custom AppError with proper status and error envelope', async () => {
    const res = await request(app).get('/test/custom-error');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid system parameters');
    expect(res.body.error.details).toEqual([{ field: 'slug', message: 'required' }]);
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('formats NotFoundError correctly with 404 status', async () => {
    const res = await request(app).get('/test/not-found');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain("System with identifier '999' was not found");
  });

  it('formats Zod validation errors cleanly', async () => {
    const res = await request(app).post('/test/zod-validation').send({ name: 'ab', port: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
