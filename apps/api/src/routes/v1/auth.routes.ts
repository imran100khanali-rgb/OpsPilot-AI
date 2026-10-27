import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { verifyPassword } from '../../utils/password.js';
import {
  createSession,
  revokeSession,
  SESSION_DURATION_MS,
} from '../../services/session.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { requireAuth, requireCsrf } from '../../middlewares/auth.js';
import { LoginSchema, User, Organization } from '@opspilot/shared';
import { env } from '../../config/env.js';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and issues secure server-side session
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const result = await query<{
      u_id: string;
      u_org_id: string;
      u_email: string;
      u_password_hash: string;
      u_first_name: string;
      u_last_name: string;
      u_role: 'Director' | 'Manager' | 'Admin';
      u_is_active: boolean;
      u_created_at: Date;
      u_updated_at: Date;
      org_id: string;
      org_name: string;
      org_slug: string;
      org_created_at: Date;
      org_updated_at: Date;
    }>(
      `SELECT
         u.id AS u_id,
         u.organization_id AS u_org_id,
         u.email AS u_email,
         u.password_hash AS u_password_hash,
         u.first_name AS u_first_name,
         u.last_name AS u_last_name,
         u.role AS u_role,
         u.is_active AS u_is_active,
         u.created_at AS u_created_at,
         u.updated_at AS u_updated_at,
         o.id AS org_id,
         o.name AS org_name,
         o.slug AS org_slug,
         o.created_at AS org_created_at,
         o.updated_at AS org_updated_at
       FROM users u
       INNER JOIN organizations o ON o.id = u.organization_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email],
    );

    if (result.rows.length === 0) {
      // Timing attack mitigation: do dummy hash comparison
      await verifyPassword(
        password,
        '$2b$12$e80yvV7.Z6z6kU8F3.nIqO6JvJbI4o4tYgNnF4HqfW7p.C0eJ6Yiq',
      );
      throw new UnauthorizedError('Invalid email or password');
    }

    const row = result.rows[0]!;

    if (!row.u_is_active) {
      throw new UnauthorizedError('Account is deactivated. Contact an administrator.');
    }

    const isMatch = await verifyPassword(password, row.u_password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Create session in database
    const session = await createSession({
      userId: row.u_id,
      organizationId: row.org_id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    // 1. Set HTTP-only session cookie
    res.cookie('opspilot_session', session.rawToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    });

    // 2. Set client-readable CSRF cookie
    res.cookie('opspilot_csrf', session.csrfToken, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS,
    });

    const user: User = {
      id: row.u_id,
      organizationId: row.u_org_id,
      email: row.u_email,
      firstName: row.u_first_name,
      lastName: row.u_last_name,
      role: row.u_role,
      isActive: row.u_is_active,
      createdAt: row.u_created_at.toISOString(),
      updatedAt: row.u_updated_at.toISOString(),
    };

    const organization: Organization = {
      id: row.org_id,
      name: row.org_name,
      slug: row.org_slug,
      createdAt: row.org_created_at.toISOString(),
      updatedAt: row.org_updated_at.toISOString(),
    };

    req.log?.info(`User logged in successfully`, {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: organization.id,
    });

    return sendSuccess(res, {
      user,
      organization,
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Destroys server-side session and clears cookies
 */
router.post(
  '/logout',
  requireAuth,
  requireCsrf,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken =
        req.cookies?.['opspilot_session'] || req.headers.authorization?.replace(/^Bearer\s+/, '');
      if (rawToken) {
        await revokeSession(rawToken);
      }

      res.clearCookie('opspilot_session', { path: '/' });
      res.clearCookie('opspilot_csrf', { path: '/' });

      req.log?.info(`User logged out`, { userId: req.user?.id });

      return sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/auth/me
 * Retrieves current authenticated user and organization session
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return sendSuccess(res, {
    user: req.user,
    organization: req.organization,
  });
});

export default router;
