import { z } from 'zod';

export interface ToolExecutionContext {
  organizationId: string;
  userId: string;
  role: string;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: unknown;
  sourceRecords: Array<{
    type: 'project' | 'task' | 'approval' | 'collection';
    id: string;
    name: string;
    status?: string;
    priority?: string;
    dueDate?: string;
  }>;
  suggestedActions: Array<{
    id: string;
    label: string;
    actionType: 'navigate' | 'filter' | 'review_approval';
    targetUrl: string;
    description?: string;
  }>;
  error?: string;
}

// 1. get_projects
export const GetProjectsSchema = z.object({
  status: z
    .enum(['active', 'blocked', 'completed', 'paused', 'archived', 'all'])
    .optional()
    .default('all'),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
export type GetProjectsArgs = z.infer<typeof GetProjectsSchema>;

// 2. get_project_details
export const GetProjectDetailsSchema = z.object({
  projectId: z.string().uuid('Invalid project ID UUID'),
});
export type GetProjectDetailsArgs = z.infer<typeof GetProjectDetailsSchema>;

// 3. get_tasks
export const GetTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z
    .enum(['todo', 'in_progress', 'review', 'blocked', 'done', 'all'])
    .optional()
    .default('all'),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'all']).optional().default('all'),
  isOverdue: z.boolean().optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
export type GetTasksArgs = z.infer<typeof GetTasksSchema>;

// 4. get_overdue_work
export const GetOverdueWorkSchema = z.object({
  category: z.enum(['tasks', 'collections', 'all']).optional().default('all'),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
export type GetOverdueWorkArgs = z.infer<typeof GetOverdueWorkSchema>;

// 5. get_pending_approvals
export const GetPendingApprovalsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});
export type GetPendingApprovalsArgs = z.infer<typeof GetPendingApprovalsSchema>;

// 6. get_dashboard_metrics
export const GetDashboardMetricsSchema = z.object({
  timeframe: z.enum(['7d', '14d', '30d', 'all']).optional().default('30d'),
});
export type GetDashboardMetricsArgs = z.infer<typeof GetDashboardMetricsSchema>;

export const APPROVED_TOOLS_METADATA = [
  {
    name: 'get_projects',
    description:
      'Query and filter projects in your organization. Supports status filter (active, blocked, completed, paused) and search keywords.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'blocked', 'completed', 'paused', 'archived', 'all'],
          description: 'Filter projects by status',
        },
        search: { type: 'string', description: 'Search project name or description' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
  {
    name: 'get_project_details',
    description:
      'Retrieve comprehensive details for a specific project by UUID, including summary and task progress.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', format: 'uuid', description: 'The project UUID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_tasks',
    description:
      'Query tasks across your organization or within a project. Supports filtering by status, priority, overdue SLA, and search.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', format: 'uuid', description: 'Optional project UUID' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'review', 'blocked', 'done', 'all'],
        },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low', 'all'] },
        isOverdue: { type: 'boolean', description: 'Filter tasks that breached their due date' },
        search: { type: 'string', description: 'Search task title or description' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
  {
    name: 'get_overdue_work',
    description:
      'Identify critical overdue items across the organization: overdue tasks and overdue collection invoices.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['tasks', 'collections', 'all'],
          description: 'Type of overdue items to inspect',
        },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
  {
    name: 'get_pending_approvals',
    description:
      'Inspect pending approval requests requiring executive review or sign-off in the organization.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
  {
    name: 'get_dashboard_metrics',
    description:
      'Fetch high-level executive KPI metrics including active projects, overdue task count, blocked projects, pending approvals, and completion rate.',
    parameters: {
      type: 'object',
      properties: {
        timeframe: { type: 'string', enum: ['7d', '14d', '30d', 'all'], default: '30d' },
      },
    },
  },
];
