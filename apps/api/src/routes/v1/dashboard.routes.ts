import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardSummary, getDashboardTrends } from '../../services/dashboard.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { requireAuth } from '../../middlewares/auth.js';
import { DashboardFilterSchema } from '@opspilot/shared';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/dashboard/summary
 * Returns KPI metrics, deterministic risk items, status breakdowns,
 * and collection follow-up indicators strictly scoped to user's organization.
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = DashboardFilterSchema.parse(req.query);
    const orgId = req.user!.organizationId;

    const summary = await getDashboardSummary(orgId, filters);
    return sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/trends
 * Returns time-series operations trends over the past 14 days.
 */
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const trends = await getDashboardTrends(orgId, 14);
    return sendSuccess(res, trends);
  } catch (error) {
    next(error);
  }
});

export default router;
