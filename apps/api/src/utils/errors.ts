export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(params: {
    message: string;
    statusCode?: number;
    errorCode?: string;
    isOperational?: boolean;
    details?: unknown;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.statusCode = params.statusCode ?? 500;
    this.errorCode = params.errorCode ?? 'INTERNAL_SERVER_ERROR';
    this.isOperational = params.isOperational ?? true;
    this.details = params.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super({
      message,
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      isOperational: true,
      details,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string | number) {
    const message = id
      ? `${resource} with identifier '${id}' was not found`
      : `${resource} not found`;
    super({
      message,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      isOperational: true,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({
      message,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      isOperational: true,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super({
      message,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      isOperational: true,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super({
      message,
      statusCode: 409,
      errorCode: 'CONFLICT',
      isOperational: true,
      details,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details?: unknown) {
    super({
      message,
      statusCode: 500,
      errorCode: 'DATABASE_ERROR',
      isOperational: true,
      details,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error occurred', details?: unknown) {
    super({
      message,
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      isOperational: false,
      details,
    });
  }
}
