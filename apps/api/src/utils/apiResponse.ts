import { Response, Request } from 'express';
import { ApiResponse, ApiErrorResponse } from '@opspilot/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  extraMeta?: Record<string, unknown>,
): Response<ApiResponse<T>> {
  const req = res.req as Request | undefined;
  const requestId = (req?.requestId || res.getHeader('x-request-id')) as string | undefined;

  const responseBody: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      ...extraMeta,
    },
  };

  return res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response<ApiErrorResponse> {
  const req = res.req as Request | undefined;
  const requestId = (req?.requestId || res.getHeader('x-request-id')) as string | undefined;

  const responseBody: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(responseBody);
}
