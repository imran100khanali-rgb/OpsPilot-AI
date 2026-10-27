import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { validateSession, SessionRecord } from '../services/session.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { User, Organization, UserRole } from '@opspilot/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      organization?: Organization;
      session?: SessionRecord;
      authMethod?: 'cookie' | 'bearer';
    }
  }
}

/**
 * Extracts and validates session from HTTP-only cookie or Authorization header.
 * Attaches user, organization, and session to req.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let rawToken: string | undefined;
    let authMethod: 'cookie' | 'bearer' = 'cookie';

    // 1. Try HTTP-only session cookie
    if (req.cookies && req.cookies['opspilot_session']) {
      rawToken = req.cookies['opspilot_session'];
      authMethod = 'cookie';
    }

    // 2. Try Authorization: Bearer <token> header (precedence for API consumers)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
      authMethod = 'bearer';
    }

    if (!rawToken) {
      return next();
    }

    const validated = await validateSession(rawToken, authMethod);
    if (!validated) {
      return next();
    }

    req.user = validated.user;
    req.organization = validated.organization;
    req.session = validated.session;
    req.authMethod = validated.authMethod;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Ensures user is authenticated. Throws 401 if not.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || !req.session || !req.organization) {
    return next(new UnauthorizedError('Authentication required. Please log in.'));
  }
  next();
}

/**
 * Enforces CSRF token validation on state-changing requests when authenticated via cookie.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  // If not authenticated via cookie, CSRF is not applicable
  if (req.authMethod !== 'cookie') {
    return next();
  }

  // Safe HTTP read methods are exempt from CSRF
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (!isStateChanging) {
    return next();
  }

  const csrfHeader = req.header('x-csrf-token');
  const expectedSecret = req.session?.csrfSecret;

  if (!csrfHeader || !expectedSecret) {
    return next(new ForbiddenError('Missing CSRF token for cookie-authenticated request'));
  }

  try {
    const headerBuf = Buffer.from(csrfHeader);
    const expectedBuf = Buffer.from(expectedSecret);

    if (
      headerBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(headerBuf, expectedBuf)
    ) {
      return next(new ForbiddenError('Invalid CSRF token'));
    }
  } catch {
    return next(new ForbiddenError('Invalid CSRF token format'));
  }

  next();
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      req.log?.warn(`Privilege escalation attempt blocked`, {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
      });

      return next(
        new ForbiddenError(
          `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
}
