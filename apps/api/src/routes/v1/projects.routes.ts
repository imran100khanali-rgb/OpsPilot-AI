import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { NotFoundError } from '../../utils/errors.js';
import { requireAuth, requireCsrf } from '../../middlewares/auth.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectFilterSchema,
  Project,
  UuidSchema,
  PaginatedResult,
} from '@opspilot/shared';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/projects
 * Lists projects with search, filtering, sorting, and pagination.
 * Scoped strictly to the authenticated user's organization.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = ProjectFilterSchema.parse(req.query);
    const orgId = req.user!.organizationId;

    const queryParams: unknown[] = [orgId];
    let whereClause = 'WHERE p.organization_id = $1';

    if (filters.search && filters.search.trim()) {
      queryParams.push(`%${filters.search.trim()}%`);
      whereClause += ` AND (p.name ILIKE $${queryParams.length} OR p.description ILIKE $${queryParams.length})`;
    }

    if (filters.status && filters.status !== 'all') {
      queryParams.push(filters.status);
      whereClause += ` AND p.status = $${queryParams.length}`;
    }

    if (filters.startDate) {
      queryParams.push(filters.startDate);
      whereClause += ` AND p.created_at >= $${queryParams.length}`;
    }

    if (filters.endDate) {
      queryParams.push(filters.endDate);
      whereClause += ` AND p.created_at <= $${queryParams.length}`;
    }

    // Count total matches
    const countSql = `SELECT COUNT(*) AS total FROM projects p ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Sorting & Pagination
    const validSortCols: Record<string, string> = {
      name: 'p.name',
      created_at: 'p.created_at',
      status: 'p.status',
    };
    const sortCol = validSortCols[filters.sortBy] || 'p.created_at';
    const sortDir = filters.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (filters.page - 1) * filters.limit;
    queryParams.push(filters.limit, offset);

    const dataSql = `
      WITH p_tasks AS (
        SELECT
          t.project_id,
          COUNT(t.id)::int AS task_count,
          COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed_count,
          COUNT(t.id) FILTER (WHERE t.status = 'blocked')::int AS blocked_count,
          COUNT(t.id) FILTER (WHERE t.status = 'blocked' AND t.priority = 'urgent')::int AS urgent_blocked_count,
          COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP)::int AS overdue_count,
          COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_TIMESTAMP - INTERVAL '7 days')::int AS severely_overdue_count,
          MIN(t.due_date) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL) AS next_due_date
        FROM tasks t
        WHERE t.organization_id = $1
        GROUP BY t.project_id
      ),
      p_approvals AS (
        SELECT
          t.project_id,
          COUNT(a.id) FILTER (WHERE a.status = 'pending' AND a.created_at <= CURRENT_TIMESTAMP - INTERVAL '48 hours')::int AS aging_approval_count
        FROM approvals a
        JOIN tasks t ON t.id = a.task_id
        WHERE a.organization_id = $1
        GROUP BY t.project_id
      )
      SELECT
        p.id,
        p.organization_id AS "organizationId",
        p.name,
        p.description,
        p.status,
        p.created_by AS "createdBy",
        TRIM(u.first_name || ' ' || u.last_name) AS "deliveryLead",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(pt.task_count, 0) AS "taskCount",
        COALESCE(pt.completed_count, 0) AS "completedTaskCount",
        COALESCE(pt.blocked_count, 0) AS "blockedTaskCount",
        COALESCE(pt.overdue_count, 0) AS "overdueDeliverables",
        pt.next_due_date AS "targetGoLive",
        CASE
          WHEN p.status = 'blocked' OR COALESCE(pt.urgent_blocked_count, 0) > 0 OR COALESCE(pt.severely_overdue_count, 0) > 0 THEN 'red'
          WHEN COALESCE(pa.aging_approval_count, 0) > 0 OR COALESCE(pt.overdue_count, 0) > 0 OR COALESCE(pt.blocked_count, 0) > 0 THEN 'amber'
          ELSE 'green'
        END AS "healthStatus",
        CASE
          WHEN p.status = 'blocked' THEN 'Project status blocked'
          WHEN COALESCE(pt.urgent_blocked_count, 0) > 0 THEN 'Urgent delivery blocker present'
          WHEN COALESCE(pt.severely_overdue_count, 0) > 0 THEN 'Milestone overdue past 7 days'
          WHEN COALESCE(pa.aging_approval_count, 0) > 0 THEN 'Release approval pending > 48h'
          WHEN COALESCE(pt.overdue_count, 0) > 0 THEN 'Deliverable overdue past target SLA'
          WHEN COALESCE(pt.blocked_count, 0) > 0 THEN 'Task blocked awaiting dependency'
          ELSE 'On track — zero active blockers'
        END AS "primaryRisk"
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by AND u.organization_id = p.organization_id
      LEFT JOIN p_tasks pt ON pt.project_id = p.id
      LEFT JOIN p_approvals pa ON pa.project_id = p.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const result = await query<Project>(dataSql, queryParams);

    const responseData: PaginatedResult<Project> = {
      items: result.rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };

    return sendSuccess(res, responseData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:id
 * Retrieves a single project. Strictly enforces multi-tenant scoping.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;

    const result = await query<Project>(
      `WITH p_tasks AS (
         SELECT
           t.project_id,
           COUNT(t.id)::int AS task_count,
           COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS completed_count,
           COUNT(t.id) FILTER (WHERE t.status = 'blocked')::int AS blocked_count,
           COUNT(t.id) FILTER (WHERE t.status = 'blocked' AND t.priority = 'urgent')::int AS urgent_blocked_count,
           COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP)::int AS overdue_count,
           COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_TIMESTAMP - INTERVAL '7 days')::int AS severely_overdue_count,
           MIN(t.due_date) FILTER (WHERE t.status != 'done' AND t.due_date IS NOT NULL) AS next_due_date
         FROM tasks t
         WHERE t.organization_id = $2 AND t.project_id = $1
         GROUP BY t.project_id
       ),
       p_approvals AS (
         SELECT
           t.project_id,
           COUNT(a.id) FILTER (WHERE a.status = 'pending' AND a.created_at <= CURRENT_TIMESTAMP - INTERVAL '48 hours')::int AS aging_approval_count
         FROM approvals a
         JOIN tasks t ON t.id = a.task_id
         WHERE a.organization_id = $2 AND t.project_id = $1
         GROUP BY t.project_id
       )
       SELECT
         p.id,
         p.organization_id AS "organizationId",
         p.name,
         p.description,
         p.status,
         p.created_by AS "createdBy",
         TRIM(u.first_name || ' ' || u.last_name) AS "deliveryLead",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt",
         COALESCE(pt.task_count, 0) AS "taskCount",
         COALESCE(pt.completed_count, 0) AS "completedTaskCount",
         COALESCE(pt.blocked_count, 0) AS "blockedTaskCount",
         COALESCE(pt.overdue_count, 0) AS "overdueDeliverables",
         pt.next_due_date AS "targetGoLive",
         CASE
           WHEN p.status = 'blocked' OR COALESCE(pt.urgent_blocked_count, 0) > 0 OR COALESCE(pt.severely_overdue_count, 0) > 0 THEN 'red'
           WHEN COALESCE(pa.aging_approval_count, 0) > 0 OR COALESCE(pt.overdue_count, 0) > 0 OR COALESCE(pt.blocked_count, 0) > 0 THEN 'amber'
           ELSE 'green'
         END AS "healthStatus",
         CASE
           WHEN p.status = 'blocked' THEN 'Project status blocked'
           WHEN COALESCE(pt.urgent_blocked_count, 0) > 0 THEN 'Urgent delivery blocker present'
           WHEN COALESCE(pt.severely_overdue_count, 0) > 0 THEN 'Milestone overdue past 7 days'
           WHEN COALESCE(pa.aging_approval_count, 0) > 0 THEN 'Release approval pending > 48h'
           WHEN COALESCE(pt.overdue_count, 0) > 0 THEN 'Deliverable overdue past target SLA'
           WHEN COALESCE(pt.blocked_count, 0) > 0 THEN 'Task blocked awaiting dependency'
           ELSE 'On track — zero active blockers'
         END AS "primaryRisk"
       FROM projects p
       LEFT JOIN users u ON u.id = p.created_by AND u.organization_id = p.organization_id
       LEFT JOIN p_tasks pt ON pt.project_id = p.id
       LEFT JOIN p_approvals pa ON pa.project_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [projectId, orgId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project', projectId);
    }

    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects
 * Creates a new project in the authenticated user's organization
 */
router.post('/', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateProjectSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;

    const result = await query<Project>(
      `INSERT INTO projects (organization_id, name, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         organization_id AS "organizationId",
         name,
         description,
         status,
         created_by AS "createdBy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [orgId, validatedData.name, validatedData.description || null, validatedData.status, userId],
    );

    req.log?.info('Created new organization project', {
      projectId: result.rows[0]?.id,
      organizationId: orgId,
    });

    return sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/projects/:id
 * Updates an existing project. Strictly enforces multi-tenant scoping.
 */
router.put('/:id', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;
    const validatedData = UpdateProjectSchema.parse(req.body);

    // Verify existence within user's organization
    const existing = await query<Project>(
      'SELECT id, name, description, status FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, orgId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Project', projectId);
    }

    const current = existing.rows[0]!;
    const newName = validatedData.name !== undefined ? validatedData.name : current.name;
    const newDesc =
      validatedData.description !== undefined ? validatedData.description : current.description;
    const newStatus = validatedData.status !== undefined ? validatedData.status : current.status;

    const result = await query<Project>(
      `UPDATE projects
       SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND organization_id = $5
       RETURNING
         id,
         organization_id AS "organizationId",
         name,
         description,
         status,
         created_by AS "createdBy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [newName, newDesc, newStatus, projectId, orgId],
    );

    req.log?.info('Updated organization project', { projectId, organizationId: orgId });
    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/projects/:id
 * Deletes a project and cascaded tasks. Strictly enforces multi-tenant scoping.
 */
router.delete('/:id', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;

    const result = await query('DELETE FROM projects WHERE id = $1 AND organization_id = $2', [
      projectId,
      orgId,
    ]);

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError('Project', projectId);
    }

    req.log?.info('Deleted organization project', { projectId, organizationId: orgId });
    return sendSuccess(res, { message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
