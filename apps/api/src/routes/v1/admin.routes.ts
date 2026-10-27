import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { User } from '@opspilot/shared';

const router = Router();

// Strict Admin-only boundary
router.use(requireAuth);
router.use(requireRole(['Admin']));

/**
 * GET /api/v1/admin/users
 * Restricted to Admins. Lists all users in the tenant organization.
 * Explicitly projects out and never returns password hashes.
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const result = await query<User>(
      `SELECT
         id,
         organization_id AS "organizationId",
         email,
         first_name AS "firstName",
         last_name AS "lastName",
         role,
         is_active AS "isActive",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM users
       WHERE organization_id = $1
       ORDER BY last_name ASC, first_name ASC`,
      [orgId],
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
