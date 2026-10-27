import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Augment Express Request interface with requestId and logger
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.header('x-request-id');
  const requestId = existingId && existingId.trim().length > 0 ? existingId.trim() : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
