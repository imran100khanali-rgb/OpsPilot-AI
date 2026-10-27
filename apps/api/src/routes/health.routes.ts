import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db/pool.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { HealthCheckResult, HealthStatus } from '@opspilot/shared';

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Comprehensive system health including database status, memory utilization, and uptime
 */
router.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();
  const memoryUsage = process.memoryUsage();

  const memory = {
    heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
    heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
    rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
  };

  const overallStatus: HealthStatus = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

  const healthData: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    version: '0.1.0',
    environment: env.NODE_ENV,
    components: {
      database: dbHealth,
      memory,
    },
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  return sendSuccess(res, healthData, statusCode);
});

/**
 * GET /api/health/live
 * Kubernetes/Docker liveness probe: indicates process is alive and accepting traffic
 */
router.get('/live', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Kubernetes/Docker readiness probe: verifies database dependency is ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();

  if (dbHealth.status === 'unhealthy') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'PostgreSQL database is currently unavailable',
        details: dbHealth,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return sendSuccess(res, {
    status: 'ready',
    database: dbHealth.status,
    latencyMs: dbHealth.latencyMs,
    timestamp: new Date().toISOString(),
  });
});

export default router;
