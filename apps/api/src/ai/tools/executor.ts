import { query } from '../../db/pool.js';
import {
  GetDashboardMetricsSchema,
  GetOverdueWorkSchema,
  GetProjectDetailsSchema,
  GetProjectsSchema,
  GetTasksSchema,
  GetPendingApprovalsSchema,
  ToolExecutionContext,
  ToolExecutionResult,
} from './definitions.js';

export async function executeTool(
  toolName: string,
  rawArgs: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const { organizationId, role: _role } = context;

  switch (toolName) {
    case 'get_projects': {
      const parsed = GetProjectsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid arguments for get_projects: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const { status, search, limit } = parsed.data;
      const params: unknown[] = [organizationId];
      let sql = `
        SELECT
          p.id,
          p.name,
          p.description,
          p.status,
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          COUNT(t.id)::int AS "taskCount",
          COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS "completedTaskCount",
          COUNT(t.id) FILTER (WHERE t.status = 'blocked')::int AS "blockedTaskCount"
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.organization_id = $1
      `;

      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND p.status = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
      }

      sql += ` GROUP BY p.id ORDER BY p.updated_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await query<{
        id: string;
        name: string;
        description?: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        taskCount: number;
        completedTaskCount: number;
        blockedTaskCount: number;
      }>(sql, params);

      const sourceRecords = res.rows.map((p) => ({
        type: 'project' as const,
        id: p.id,
        name: p.name,
        status: p.status,
      }));

      const hasBlocked = res.rows.some((p) => p.status === 'blocked' || p.blockedTaskCount > 0);
      const suggestedActions = hasBlocked
        ? [
            {
              id: 'filter-blocked-projects',
              label: 'View Blocked Projects Workspace',
              actionType: 'navigate' as const,
              targetUrl: '/projects?status=blocked',
              description: 'Open the operational workspace filtered to blocked projects',
            },
          ]
        : [];

      return {
        toolName,
        success: true,
        data: {
          count: res.rows.length,
          projects: res.rows,
        },
        sourceRecords,
        suggestedActions,
      };
    }

    case 'get_project_details': {
      const parsed = GetProjectDetailsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid project ID: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const { projectId } = parsed.data;

      const projectRes = await query<{
        id: string;
        name: string;
        description?: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT id, name, description, status, created_at, updated_at FROM projects WHERE id = $1 AND organization_id = $2`,
        [projectId, organizationId],
      );

      if (projectRes.rows.length === 0) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Project not found or not accessible within your organization.`,
        };
      }

      const proj = projectRes.rows[0]!;

      const tasksRes = await query<{
        id: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
      }>(
        `SELECT id, title, status, priority, due_date FROM tasks WHERE project_id = $1 AND organization_id = $2 ORDER BY priority = 'urgent' DESC, due_date ASC`,
        [projectId, organizationId],
      );

      const sourceRecords = [
        {
          type: 'project' as const,
          id: proj.id,
          name: proj.name,
          status: proj.status,
        },
        ...tasksRes.rows.map((t) => ({
          type: 'task' as const,
          id: t.id,
          name: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date || undefined,
        })),
      ];

      return {
        toolName,
        success: true,
        data: {
          project: proj,
          totalTasks: tasksRes.rows.length,
          tasks: tasksRes.rows,
        },
        sourceRecords,
        suggestedActions: [
          {
            id: `view-project-tasks-${proj.id}`,
            label: `View Tasks for ${proj.name}`,
            actionType: 'navigate' as const,
            targetUrl: `/tasks?projectId=${proj.id}`,
            description: `Filter tasks by ${proj.name}`,
          },
        ],
      };
    }

    case 'get_tasks': {
      const parsed = GetTasksSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid arguments for get_tasks: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const { projectId, status, priority, isOverdue, search, limit } = parsed.data;
      const params: unknown[] = [organizationId];
      let sql = `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date AS "dueDate",
          t.project_id AS "projectId",
          p.name AS "projectName",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt",
          (t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP) AS "isOverdue"
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.organization_id = $1
      `;

      if (projectId) {
        params.push(projectId);
        sql += ` AND t.project_id = $${params.length}`;
      }

      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND t.status = $${params.length}`;
      }

      if (priority && priority !== 'all') {
        params.push(priority);
        sql += ` AND t.priority = $${params.length}`;
      }

      if (isOverdue === true) {
        sql += ` AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`;
      }

      sql += ` ORDER BY t.priority = 'urgent' DESC, t.due_date ASC NULLS LAST LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await query<{
        id: string;
        title: string;
        description?: string;
        status: string;
        priority: string;
        dueDate: string | null;
        projectId?: string;
        projectName?: string;
        createdAt: string;
        updatedAt: string;
        isOverdue: boolean;
      }>(sql, params);

      const sourceRecords = res.rows.map((t) => ({
        type: 'task' as const,
        id: t.id,
        name: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate || undefined,
      }));

      const hasOverdue = res.rows.some((t) => t.isOverdue);
      const suggestedActions = hasOverdue
        ? [
            {
              id: 'view-overdue-tasks',
              label: 'View Overdue Tasks in Workspace',
              actionType: 'navigate' as const,
              targetUrl: '/tasks?isOverdue=true',
              description: 'Open the tasks workspace filtered to overdue tasks',
            },
          ]
        : [];

      return {
        toolName,
        success: true,
        data: {
          count: res.rows.length,
          tasks: res.rows,
        },
        sourceRecords,
        suggestedActions,
      };
    }

    case 'get_overdue_work': {
      const parsed = GetOverdueWorkSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid arguments for get_overdue_work: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const { category, limit } = parsed.data;
      const overdueTasksRes =
        category === 'tasks' || category === 'all'
          ? await query<{
              id: string;
              title: string;
              status: string;
              priority: string;
              due_date: string;
              project_id: string;
              project_name: string;
              days_overdue: number;
            }>(
              `SELECT
                t.id,
                t.title,
                t.status,
                t.priority,
                t.due_date,
                t.project_id,
                p.name AS project_name,
                ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date)) / 86400)::int AS days_overdue
              FROM tasks t
              LEFT JOIN projects p ON p.id = t.project_id
              WHERE t.organization_id = $1
                AND t.status != 'done'
                AND t.due_date IS NOT NULL
                AND t.due_date < CURRENT_TIMESTAMP
              ORDER BY t.priority = 'urgent' DESC, t.due_date ASC
              LIMIT $2`,
              [organizationId, limit],
            )
          : { rows: [] };

      const overdueCollectionsRes =
        category === 'collections' || category === 'all'
          ? await query<{
              id: string;
              customer_name: string;
              invoice_number: string;
              amount: string;
              due_date: string;
              status: string;
              days_overdue: number;
            }>(
              `SELECT
                id,
                customer_name,
                invoice_number,
                amount,
                due_date,
                status,
                ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - due_date)) / 86400)::int AS days_overdue
              FROM collections
              WHERE organization_id = $1
                AND status IN ('pending', 'overdue', 'escalated')
                AND due_date < CURRENT_TIMESTAMP
              ORDER BY amount::numeric DESC
              LIMIT $2`,
              [organizationId, limit],
            )
          : { rows: [] };

      const sourceRecords: ToolExecutionResult['sourceRecords'] = [
        ...overdueTasksRes.rows.map((t) => ({
          type: 'task' as const,
          id: t.id,
          name: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date,
        })),
        ...overdueCollectionsRes.rows.map((c) => ({
          type: 'collection' as const,
          id: c.id,
          name: `${c.customer_name} (${c.invoice_number} - $${Number(c.amount).toLocaleString()})`,
          status: c.status,
          dueDate: c.due_date,
        })),
      ];

      const suggestedActions: ToolExecutionResult['suggestedActions'] = [];
      if (overdueTasksRes.rows.length > 0) {
        suggestedActions.push({
          id: 'filter-overdue-tasks',
          label: 'View Overdue Tasks List',
          actionType: 'navigate',
          targetUrl: '/tasks?isOverdue=true',
          description: 'Inspect all overdue task deadlines',
        });
      }

      return {
        toolName,
        success: true,
        data: {
          overdueTasksCount: overdueTasksRes.rows.length,
          overdueTasks: overdueTasksRes.rows,
          overdueCollectionsCount: overdueCollectionsRes.rows.length,
          overdueCollections: overdueCollectionsRes.rows,
        },
        sourceRecords,
        suggestedActions,
      };
    }

    case 'get_pending_approvals': {
      const parsed = GetPendingApprovalsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid arguments for get_pending_approvals: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      const { limit } = parsed.data;

      const res = await query<{
        id: string;
        title: string;
        notes: string | null;
        created_at: string;
        requester_name: string;
      }>(
        `SELECT
          a.id,
          a.title,
          a.notes,
          a.created_at,
          TRIM(u.first_name || ' ' || u.last_name) AS requester_name
        FROM approvals a
        JOIN users u ON u.id = a.requested_by
        WHERE a.organization_id = $1 AND a.status = 'pending'
        ORDER BY a.created_at ASC
        LIMIT $2`,
        [organizationId, limit],
      );

      const sourceRecords = res.rows.map((a) => ({
        type: 'approval' as const,
        id: a.id,
        name: a.title,
        status: 'pending',
      }));

      const suggestedActions =
        res.rows.length > 0
          ? [
              {
                id: 'review-pending-approvals',
                label: 'Review Pending Approvals',
                actionType: 'navigate' as const,
                targetUrl: '/',
                description: 'Review pending operational sign-offs on dashboard',
              },
            ]
          : [];

      return {
        toolName,
        success: true,
        data: {
          count: res.rows.length,
          pendingApprovals: res.rows,
        },
        sourceRecords,
        suggestedActions,
      };
    }

    case 'get_dashboard_metrics': {
      const parsed = GetDashboardMetricsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          data: null,
          sourceRecords: [],
          suggestedActions: [],
          error: `Invalid arguments: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // 1. Projects Breakdown
      const projRes = await query<{
        total: string;
        active: string;
        blocked: string;
      }>(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked
        FROM projects WHERE organization_id = $1`,
        [organizationId],
      );

      // 2. Tasks Breakdown
      const taskRes = await query<{
        total: string;
        done: string;
        overdue: string;
      }>(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'done')::int AS done,
          COUNT(*) FILTER (WHERE status != 'done' AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP)::int AS overdue
        FROM tasks WHERE organization_id = $1`,
        [organizationId],
      );

      // 3. Approvals
      const appRes = await query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM approvals WHERE organization_id = $1 AND status = 'pending'`,
        [organizationId],
      );

      // 4. Collections
      const collRes = await query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM collections WHERE organization_id = $1 AND status IN ('pending', 'overdue', 'escalated') AND due_date < CURRENT_TIMESTAMP`,
        [organizationId],
      );

      const activeProjects = parseInt(projRes.rows[0]?.active || '0', 10);
      const blockedProjects = parseInt(projRes.rows[0]?.blocked || '0', 10);
      const totalTasks = parseInt(taskRes.rows[0]?.total || '0', 10);
      const completedTasks = parseInt(taskRes.rows[0]?.done || '0', 10);
      const overdueTasks = parseInt(taskRes.rows[0]?.overdue || '0', 10);
      const pendingApprovals = parseInt(appRes.rows[0]?.count || '0', 10);
      const collectionFollowUps = parseInt(collRes.rows[0]?.count || '0', 10);
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        toolName,
        success: true,
        data: {
          activeProjects,
          blockedProjects,
          totalTasks,
          completedTasks,
          overdueTasks,
          pendingApprovals,
          collectionFollowUps,
          completionRate: `${completionRate}%`,
        },
        sourceRecords: [],
        suggestedActions: [
          {
            id: 'view-dashboard',
            label: 'Open Executive Dashboard',
            actionType: 'navigate',
            targetUrl: '/',
            description: 'Navigate to real-time executive dashboard',
          },
        ],
      };
    }

    default:
      return {
        toolName,
        success: false,
        data: null,
        sourceRecords: [],
        suggestedActions: [],
        error: `Tool "${toolName}" is not an approved operational query tool.`,
      };
  }
}
