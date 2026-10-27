import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { requestLoggerMiddleware } from './middlewares/logger.js';
import { authenticate } from './middlewares/auth.js';
import { notFoundMiddleware } from './middlewares/notFound.js';
import { errorHandlerMiddleware } from './middlewares/errorHandler.js';
import apiRouter from './routes/index.js';
import { sendSuccess } from './utils/apiResponse.js';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-csrf-token'],
      exposedHeaders: ['x-request-id'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Observability middlewares
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Authentication & session resolution middleware
  app.use(authenticate);

  // Root platform status
  app.get('/', (_req: Request, res: Response) => {
    sendSuccess(res, {
      platform: 'OpsPilot AI - Operations Intelligence Platform',
      version: '0.1.0',
      status: 'active',
      endpoints: {
        health: '/api/health',
        liveness: '/api/health/live',
        readiness: '/api/health/ready',
        auth: {
          login: 'POST /api/v1/auth/login',
          logout: 'POST /api/v1/auth/logout',
          me: 'GET /api/v1/auth/me',
        },
        projects: '/api/v1/projects',
        approvals: '/api/v1/approvals',
        adminUsers: '/api/v1/admin/users',
      },
    });
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // 404 and Error handling
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
