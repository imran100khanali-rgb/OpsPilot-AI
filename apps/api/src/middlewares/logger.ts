import { Request, Response, NextFunction } from 'express';
import { logger, SafeLoggerChild } from '../utils/safeLogger.js';

declare global {
  namespace Express {
    interface Request {
      log: SafeLoggerChild;
    }
  }
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = performance.now();
  const requestId = req.requestId || 'unknown';

  req.log = logger.child({
    requestId,
    service: 'opspilot-api',
  });

  res.on('finish', () => {
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const statusCode = res.statusCode;

    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      req.log.error(
        `HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`,
        logData,
      );
    } else if (statusCode >= 400) {
      req.log.warn(
        `HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`,
        logData,
      );
    } else {
      req.log.info(
        `HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`,
        logData,
      );
    }
  });

  next();
}
