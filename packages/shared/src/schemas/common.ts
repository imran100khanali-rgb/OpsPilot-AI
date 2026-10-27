import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const UuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

export const UserRoleSchema = z.enum(['Director', 'Manager', 'Admin']);

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Must provide a valid email address' }).toLowerCase().trim(),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

export const ProjectStatusSchema = z.enum(['active', 'completed', 'archived', 'paused', 'blocked']);
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const CreateProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  description: z.string().max(1000).optional(),
  status: ProjectStatusSchema.default('active'),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150).optional(),
  description: z.string().max(1000).optional(),
  status: ProjectStatusSchema.optional(),
});

export const ProjectFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'completed', 'archived', 'paused', 'blocked']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['name', 'created_at', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const CreateTaskSchema = z.object({
  projectId: z.string().uuid({ message: 'Must be a valid Project UUID' }),
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.default('todo'),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  dueDate: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional(),
});

export const TaskFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
  priority: z.enum(['all', 'low', 'medium', 'high', 'urgent']).optional(),
  projectId: z.string().uuid().optional(),
  isOverdue: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['due_date', 'priority', 'status', 'title', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const DashboardFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

export const ReviewApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(1000).optional(),
});

export const SystemEnvironmentSchema = z.enum(['production', 'staging', 'development']);
export const SystemStatusSchema = z.enum(['operational', 'degraded', 'outage', 'maintenance']);

export const CreateSystemSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with dashes'),
  description: z.string().max(500).optional(),
  environment: SystemEnvironmentSchema.default('production'),
  status: SystemStatusSchema.default('operational'),
});

export const IncidentSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const IncidentStatusSchema = z.enum(['open', 'investigating', 'mitigated', 'resolved']);

export const CreateIncidentSchema = z.object({
  systemId: z.string().uuid(),
  title: z.string().min(3).max(200),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema.default('open'),
  aiSummary: z.string().max(2000).optional(),
});
