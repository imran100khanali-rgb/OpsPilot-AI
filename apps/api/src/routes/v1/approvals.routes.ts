import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { NotFoundError } from '../../utils/errors.js';
import { requireAuth, requireRole, requireCsrf } from '../../middlewares/auth.js';
import { ReviewApprovalSchema, Approval, UuidSchema } from '@opspilot/shared';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/approvals
 * Lists approvals for the user's organization
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const result = await query<Approval>(
      `SELECT
         a.id,
         a.organization_id AS "organizationId",
         a.task_id AS "taskId",
         a.requested_by AS "requestedBy",
         TRIM(u.first_name || ' ' || u.last_name) AS "requestedByName",
         a.reviewed_by AS "reviewedBy",
         a.title,
         a.status,
         a.notes,
         (a.status = 'pending' AND a.created_at <= CURRENT_TIMESTAMP - INTERVAL '48 hours') AS "isAging",
         a.decided_at AS "decidedAt",
         a.created_at AS "createdAt"
       FROM approvals a
       LEFT JOIN users u ON u.id = a.requested_by AND u.organization_id = a.organization_id
       WHERE a.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId],
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/approvals/:id/review
 * Role-restricted: Requires role 'Director' or 'Admin'.
 * Prevents Manager or unauthorized roles from approving operational changes.
 */
router.post(
  '/:id/review',
  requireRole(['Director', 'Admin']),
  requireCsrf,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const approvalId = UuidSchema.parse(req.params.id);
      const { status, notes } = ReviewApprovalSchema.parse(req.body);
      const orgId = req.user!.organizationId;
      const reviewerId = req.user!.id;

      // Verify existence within user's organization
      const existing = await query<Approval>(
        'SELECT id FROM approvals WHERE id = $1 AND organization_id = $2',
        [approvalId, orgId],
      );

      if (existing.rows.length === 0) {
        throw new NotFoundError('Approval', approvalId);
      }

      const result = await query<Approval>(
        `UPDATE approvals
         SET status = $1, notes = $2, reviewed_by = $3, decided_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND organization_id = $5
         RETURNING
           id,
           organization_id AS "organizationId",
           task_id AS "taskId",
           requested_by AS "requestedBy",
           reviewed_by AS "reviewedBy",
           title,
           status,
           notes,
           decided_at AS "decidedAt",
           created_at AS "createdAt"`,
        [status, notes || null, reviewerId, approvalId, orgId],
      );

      req.log?.info(`Approval reviewed by ${req.user!.role}`, {
        approvalId,
        decision: status,
        reviewedBy: reviewerId,
      });

      return sendSuccess(res, result.rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
