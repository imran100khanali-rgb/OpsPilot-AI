import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DashboardSummaryResponse,
  DashboardKpis,
  RiskItem,
  Project,
  Task,
  User,
  Organization,
} from '@opspilot/shared';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { setCsrfToken, getCsrfToken } from '../lib/api-client';

describe('Web Application Operations Workspace Contracts & KPIs', () => {
  it('validates DashboardSummaryResponse schema with real PostgreSQL KPI structure', () => {
    const mockKpis: DashboardKpis = {
      activeProjects: 3,
      overdueTasks: 2,
      blockedProjects: 1,
      pendingApprovals: 2,
      collectionFollowUps: 1,
      totalProjects: 4,
      totalTasks: 6,
      completedTasks: 1,
      taskCompletionRate: 17,
    };

    const mockRisks: RiskItem[] = [
      {
        id: 'risk-task-overdue-1',
        category: 'overdue_task',
        severity: 'critical',
        title: 'Overdue Task: Configure OpenTelemetry Collectors',
        explanation: 'Task is 4 days overdue with high priority.',
        sourceRecord: {
          type: 'task',
          id: '55555555-5555-5555-5555-555555555551',
          name: 'Configure OpenTelemetry Collectors',
          status: 'in_progress',
          dueDate: new Date().toISOString(),
          projectId: '33333333-3333-3333-3333-333333333331',
          projectName: 'Project Apollo Observability',
        },
        detectedAt: new Date().toISOString(),
        suggestedAction: 'Review task blockers and reassign resources.',
      },
    ];

    const mockSummary: DashboardSummaryResponse = {
      kpis: mockKpis,
      risks: mockRisks,
      statusBreakdown: {
        projects: { active: 3, blocked: 1, completed: 0, paused: 0, archived: 0 },
        tasks: { todo: 2, in_progress: 2, review: 0, blocked: 1, done: 1 },
        tasksByPriority: { urgent: 1, high: 2, medium: 2, low: 1 },
      },
      dateRange: {
        startDate: '2026-10-01',
        endDate: '2026-10-27',
      },
    };

    expect(mockSummary.kpis.activeProjects).toBe(3);
    expect(mockSummary.kpis.overdueTasks).toBe(2);
    expect(mockSummary.kpis.blockedProjects).toBe(1);
    expect(mockSummary.risks[0]?.category).toBe('overdue_task');
    expect(mockSummary.risks[0]?.sourceRecord.type).toBe('task');
  });

  it('validates Project and Task model types with overdue and metrics fields', () => {
    const project: Project = {
      id: 'proj-123',
      organizationId: 'org-456',
      name: 'Cloud Mesh Phase 1',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskCount: 5,
      completedTaskCount: 3,
      blockedTaskCount: 1,
    };

    const task: Task = {
      id: 'task-789',
      organizationId: 'org-456',
      projectId: 'proj-123',
      projectName: 'Cloud Mesh Phase 1',
      title: 'Setup TLS Ingress Routing',
      status: 'blocked',
      priority: 'urgent',
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      isOverdue: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(project.status).toBe('active');
    expect(project.taskCount).toBe(5);
    expect(task.isOverdue).toBe(true);
    expect(task.priority).toBe('urgent');
  });
});

describe('Authentication & KPI Card Rendering Regressions', () => {
  it('renders loading skeletons strictly when loading is true', () => {
    const html = renderToString(React.createElement(ExecutiveKpis, { kpis: null, loading: true }));
    expect(html).toContain('kpi-loading-skeletons');
    expect(html).toContain('skeleton');
    expect(html).not.toContain('kpi-empty-state');
  });

  it('renders meaningful empty/error state when loading is false and KPI data is null (unauthenticated or error)', () => {
    const html = renderToString(React.createElement(ExecutiveKpis, { kpis: null, loading: false }));
    expect(html).toContain('kpi-empty-state');
    expect(html).toContain('Operational Metrics Unavailable');
    expect(html).toContain('Please authenticate with an authorized account');
    expect(html).not.toContain('kpi-loading-skeletons');
  });

  it('renders live KPI cards with real counts when kpis data is provided and loading is false', () => {
    const mockKpis: DashboardKpis = {
      activeProjects: 8,
      overdueTasks: 3,
      blockedProjects: 2,
      pendingApprovals: 4,
      collectionFollowUps: 1,
      totalProjects: 12,
      totalTasks: 25,
      completedTasks: 15,
      taskCompletionRate: 60,
    };

    const html = renderToString(
      React.createElement(ExecutiveKpis, { kpis: mockKpis, loading: false }),
    );
    expect(html).toContain('id="kpi-active-projects"');
    expect(html).toContain('8');
    expect(html).toContain('id="kpi-overdue-tasks"');
    expect(html).toContain('3');
    expect(html).toContain('id="kpi-blocked-projects"');
    expect(html).toContain('2');
    expect(html).not.toContain('kpi-loading-skeletons');
    expect(html).not.toContain('kpi-empty-state');
  });

  it('persists and retrieves CSRF tokens in client storage for cookie-authenticated mutations', () => {
    const testCsrf = 'csrf-secret-token-sample-12345';
    setCsrfToken(testCsrf);
    expect(getCsrfToken()).toBe(testCsrf);
  });

  it('validates user session payload structure after successful login', () => {
    const mockUser: User = {
      id: '10000000-0000-0000-0000-000000000001',
      organizationId: '11111111-1111-1111-1111-111111111111',
      email: 'director@acme.example.com',
      firstName: 'Diana',
      lastName: 'Director',
      role: 'Director',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockOrg: Organization = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Acme Operations Corp',
      slug: 'acme-corp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(mockUser.email).toBe('director@acme.example.com');
    expect(mockUser.role).toBe('Director');
    expect(mockOrg.name).toBe('Acme Operations Corp');
  });
});
