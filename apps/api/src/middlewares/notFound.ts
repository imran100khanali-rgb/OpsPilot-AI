import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errors.js';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl || req.url}`));
}
