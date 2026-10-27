import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sanitizeLogData } from '../utils/safeLogger.js';

describe('Middlewares & Safety', () => {
  const app = createApp();

  describe('Request ID Middleware', () => {
    it('generates a new UUID if x-request-id is not provided', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('preserves existing x-request-id if supplied by client', async () => {
      const customId = 'req-trace-custom-998811';
      const res = await request(app).get('/api/health/live').set('x-request-id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body.meta.requestId).toBe(customId);
    });
  });

  describe('Safe Logging Redaction', () => {
    it('redacts sensitive keys including password, token, authorization, and secret', () => {
      const sensitiveInput = {
        username: 'ops-admin',
        password: 'SuperSecretPassword123!',
        apiToken: 'eyJh...token',
        nested: {
          secretKey: 'top-secret',
          publicSetting: 'enabled',
        },
      };

      const sanitized = sanitizeLogData(sensitiveInput) as Record<string, unknown>;

      expect(sanitized.username).toBe('ops-admin');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiToken).toBe('[REDACTED]');
      expect((sanitized.nested as Record<string, unknown>).secretKey).toBe('[REDACTED]');
      expect((sanitized.nested as Record<string, unknown>).publicSetting).toBe('enabled');
    });

    it('redacts Bearer tokens embedded in string headers', () => {
      const headerStr = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const sanitized = sanitizeLogData(headerStr);
      expect(sanitized).toBe('Bearer [REDACTED]');
    });
  });

  describe('404 Not Found Handling', () => {
    it('returns consistent structured 404 response for unknown routes', async () => {
      const res = await request(app).get('/api/v1/unknown-endpoint-path');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
        },
      });
      expect(res.body.error).toHaveProperty('timestamp');
      expect(res.body.error).toHaveProperty('requestId');
    });
  });
});
