export type ProjectStatus = 'active' | 'completed' | 'archived' | 'paused' | 'blocked';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type CollectionStatus = 'pending' | 'overdue' | 'paid' | 'escalated';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  completedTaskCount?: number;
  blockedTaskCount?: number;
}

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  projectName?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string;
  assignedUserName?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
}

export interface Approval {
  id: string;
  organizationId: string;
  taskId?: string;
  requestedBy: string;
  reviewedBy?: string;
  title: string;
  status: ApprovalStatus;
  notes?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface CollectionRecord {
  id: string;
  organizationId: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: CollectionStatus;
  dueDate: string;
  followUpDate?: string;
  notes?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardKpis {
  activeProjects: number;
  overdueTasks: number;
  blockedProjects: number;
  pendingApprovals: number;
  collectionFollowUps: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
}

export type RiskCategory =
  'overdue_task' | 'blocked_project' | 'blocked_task' | 'stalled_approval' | 'overdue_collection';

export type RiskSeverity = 'critical' | 'high' | 'medium';

export interface RiskSourceRecord {
  type: 'task' | 'project' | 'approval' | 'collection';
  id: string;
  name: string;
  status: string;
  dueDate?: string;
  projectId?: string;
  projectName?: string;
}

export interface RiskItem {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  explanation: string;
  sourceRecord: RiskSourceRecord;
  detectedAt: string;
  suggestedAction: string;
}

export interface DashboardSummaryResponse {
  kpis: DashboardKpis;
  risks: RiskItem[];
  statusBreakdown: {
    projects: Record<string, number>;
    tasks: Record<string, number>;
    tasksByPriority: Record<string, number>;
  };
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
}

export interface TrendDataPoint {
  date: string;
  createdTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeProjects: number;
}

export interface DashboardTrendsResponse {
  trends: TrendDataPoint[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}
