import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/safeLogger.js';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const reqLog = req.log || logger;

  // Handle known AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      reqLog.error(`Operational server error: ${err.message}`, {
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        details: err.details,
      });
    } else {
      reqLog.warn(`Client error: ${err.message}`, {
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        details: err.details,
      });
    }

    sendError(res, err.statusCode, err.errorCode, err.message, err.details);
    return;
  }

  // Handle Zod validation errors
  if (
    err instanceof ZodError ||
    err.name === 'ZodError' ||
    ('issues' in err && Array.isArray((err as any).issues))
  ) {
    const issues = ((err as any).issues || []).map((issue: any) => ({
      path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path),
      message: issue.message,
      code: issue.code,
    }));

    reqLog.warn('Request validation failed', { issues });
    sendError(res, 400, 'VALIDATION_ERROR', 'Request input validation failed', issues);
    return;
  }

  // Handle JSON parsing error (e.g. malformed body)
  if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    reqLog.warn('Malformed JSON payload received');
    sendError(res, 400, 'INVALID_JSON', 'Malformed JSON payload in request body');
    return;
  }

  // Unhandled / unexpected errors
  reqLog.error(`Unhandled internal server error: ${err.message}`, {
    name: err.name,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please contact system support.'
      : err.message || 'Internal server error';

  sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
}
