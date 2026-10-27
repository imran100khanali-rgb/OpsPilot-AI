import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { requireAuth, requireCsrf } from '../../middlewares/auth.js';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFilterSchema,
  Task,
  UuidSchema,
  PaginatedResult,
} from '@opspilot/shared';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/tasks
 * Lists tasks with search, filtering, overdue checks, sorting, and pagination.
 * Scoped strictly to the authenticated user's organization.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = TaskFilterSchema.parse(req.query);
    const orgId = req.user!.organizationId;

    const queryParams: unknown[] = [orgId];
    let whereClause = 'WHERE t.organization_id = $1';

    if (filters.search && filters.search.trim()) {
      queryParams.push(`%${filters.search.trim()}%`);
      whereClause += ` AND (t.title ILIKE $${queryParams.length} OR t.description ILIKE $${queryParams.length})`;
    }

    if (filters.status && filters.status !== 'all') {
      queryParams.push(filters.status);
      whereClause += ` AND t.status = $${queryParams.length}`;
    }

    if (filters.priority && filters.priority !== 'all') {
      queryParams.push(filters.priority);
      whereClause += ` AND t.priority = $${queryParams.length}`;
    }

    if (filters.projectId) {
      queryParams.push(filters.projectId);
      whereClause += ` AND t.project_id = $${queryParams.length}`;
    }

    if (filters.isOverdue) {
      whereClause += ` AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP`;
    }

    if (filters.startDate) {
      queryParams.push(filters.startDate);
      whereClause += ` AND (t.due_date >= $${queryParams.length} OR t.created_at >= $${queryParams.length})`;
    }

    if (filters.endDate) {
      queryParams.push(filters.endDate);
      whereClause += ` AND (t.due_date <= $${queryParams.length} OR t.created_at <= $${queryParams.length})`;
    }

    // Count matching records
    const countSql = `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Sorting
    const validSortCols: Record<string, string> = {
      due_date: 't.due_date NULLS LAST',
      priority: `CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      status: 't.status',
      title: 't.title',
      created_at: 't.created_at',
    };
    const sortCol = validSortCols[filters.sortBy] || 't.created_at';
    const sortDir = filters.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (filters.page - 1) * filters.limit;
    queryParams.push(filters.limit, offset);

    const dataSql = `
      SELECT
        t.id,
        t.organization_id AS "organizationId",
        t.project_id AS "projectId",
        p.name AS "projectName",
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date AS "dueDate",
        t.assigned_to AS "assignedTo",
        CONCAT(u.first_name, ' ', u.last_name) AS "assignedUserName",
        t.created_by AS "createdBy",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt",
        (t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP) AS "isOverdue"
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const result = await query<Task>(dataSql, queryParams);

    const responseData: PaginatedResult<Task> = {
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
 * GET /api/v1/tasks/:id
 * Retrieves a single task. Strictly enforces multi-tenant scoping.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;

    const result = await query<Task>(
      `SELECT
         t.id,
         t.organization_id AS "organizationId",
         t.project_id AS "projectId",
         p.name AS "projectName",
         t.title,
         t.description,
         t.status,
         t.priority,
         t.due_date AS "dueDate",
         t.assigned_to AS "assignedTo",
         CONCAT(u.first_name, ' ', u.last_name) AS "assignedUserName",
         t.created_by AS "createdBy",
         t.created_at AS "createdAt",
         t.updated_at AS "updatedAt",
         (t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP) AS "isOverdue"
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND t.organization_id = $2`,
      [taskId, orgId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Task', taskId);
    }

    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tasks
 * Creates a new task within a verified tenant project.
 */
router.post('/', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateTaskSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;

    // Verify project belongs to user's organization
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
      [validatedData.projectId, orgId],
    );
    if (projectCheck.rows.length === 0) {
      throw new ValidationError('Specified project does not belong to your organization');
    }

    // Verify assigned user if provided belongs to user's organization
    if (validatedData.assignedTo) {
      const userCheck = await query('SELECT id FROM users WHERE id = $1 AND organization_id = $2', [
        validatedData.assignedTo,
        orgId,
      ]);
      if (userCheck.rows.length === 0) {
        throw new ValidationError('Assigned user does not belong to your organization');
      }
    }

    const result = await query<Task>(
      `INSERT INTO tasks (
         organization_id, project_id, title, description, status, priority, due_date, assigned_to, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id,
         organization_id AS "organizationId",
         project_id AS "projectId",
         title,
         description,
         status,
         priority,
         due_date AS "dueDate",
         assigned_to AS "assignedTo",
         created_by AS "createdBy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        orgId,
        validatedData.projectId,
        validatedData.title,
        validatedData.description || null,
        validatedData.status,
        validatedData.priority,
        validatedData.dueDate || null,
        validatedData.assignedTo || null,
        userId,
      ],
    );

    req.log?.info('Created new organization task', {
      taskId: result.rows[0]?.id,
      organizationId: orgId,
    });

    return sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/tasks/:id
 * Updates an existing task. Strictly enforces multi-tenant scoping.
 */
router.put('/:id', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;
    const validatedData = UpdateTaskSchema.parse(req.body);

    // Verify existence within user's organization
    const existing = await query<{
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      dueDate: Date | null;
      assignedTo: string | null;
    }>(
      `SELECT
         id,
         project_id AS "projectId",
         title,
         description,
         status,
         priority,
         due_date AS "dueDate",
         assigned_to AS "assignedTo"
       FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, orgId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Task', taskId);
    }

    const current = existing.rows[0]!;

    const newProjectId =
      validatedData.projectId !== undefined ? validatedData.projectId : current.projectId;
    const newTitle = validatedData.title !== undefined ? validatedData.title : current.title;
    const newDesc =
      validatedData.description !== undefined ? validatedData.description : current.description;
    const newStatus = validatedData.status !== undefined ? validatedData.status : current.status;
    const newPriority =
      validatedData.priority !== undefined ? validatedData.priority : current.priority;
    const newDueDate =
      validatedData.dueDate !== undefined ? validatedData.dueDate : current.dueDate;
    const newAssignedTo =
      validatedData.assignedTo !== undefined ? validatedData.assignedTo : current.assignedTo;

    const result = await query<Task>(
      `UPDATE tasks
       SET project_id = $1, title = $2, description = $3, status = $4,
           priority = $5, due_date = $6, assigned_to = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND organization_id = $9
       RETURNING
         id,
         organization_id AS "organizationId",
         project_id AS "projectId",
         title,
         description,
         status,
         priority,
         due_date AS "dueDate",
         assigned_to AS "assignedTo",
         created_by AS "createdBy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        newProjectId,
        newTitle,
        newDesc || null,
        newStatus,
        newPriority,
        newDueDate || null,
        newAssignedTo || null,
        taskId,
        orgId,
      ],
    );

    req.log?.info('Updated organization task', { taskId, organizationId: orgId });
    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/tasks/:id
 * Deletes a task. Strictly enforces multi-tenant scoping.
 */
router.delete('/:id', requireCsrf, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = UuidSchema.parse(req.params.id as string);
    const orgId = req.user!.organizationId;

    const result = await query('DELETE FROM tasks WHERE id = $1 AND organization_id = $2', [
      taskId,
      orgId,
    ]);

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError('Task', taskId);
    }

    req.log?.info('Deleted organization task', { taskId, organizationId: orgId });
    return sendSuccess(res, { message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
