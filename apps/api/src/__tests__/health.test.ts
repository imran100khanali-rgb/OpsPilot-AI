import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import * as poolModule from '../db/pool.js';

describe('Health Endpoints', () => {
  const app = createApp();

  it('GET /api/health/live returns 200 with status ok and request-id', async () => {
    const res = await request(app).get('/api/health/live');

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('x-request-id');
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
      },
    });
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('GET /api/health/ready returns 200 when database is healthy', async () => {
    vi.spyOn(poolModule, 'checkDbHealth').mockResolvedValueOnce({
      status: 'healthy',
      latencyMs: 1.5,
      message: 'PostgreSQL operational',
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.database).toBe('healthy');
  });

  it('GET /api/health/ready returns 503 when database is unhealthy', async () => {
    vi.spyOn(poolModule, 'checkDbHealth').mockResolvedValueOnce({
      status: 'unhealthy',
      latencyMs: 50,
      message: 'Connection timeout',
    });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('GET /api/health returns comprehensive status object', async () => {
    vi.spyOn(poolModule, 'checkDbHealth').mockResolvedValueOnce({
      status: 'healthy',
      latencyMs: 2.1,
      message: 'PostgreSQL operational',
    });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptimeSeconds');
    expect(res.body.data).toHaveProperty('environment');
    expect(res.body.data.components).toHaveProperty('database');
    expect(res.body.data.components).toHaveProperty('memory');
  });
});
