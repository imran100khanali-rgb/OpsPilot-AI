import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Navbar } from '../components/Navbar';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import {
  loginUser,
  getCurrentUser,
  fetchDashboardSummary,
  setCsrfToken,
  getCsrfToken,
} from '../lib/api-client';
import { DashboardSummaryResponse, User, Organization } from '@opspilot/shared';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Regression Tests: Authentication & Dashboard Lifecycle', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.NODE_ENV;

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

  beforeEach(() => {
    vi.clearAllMocks();
    setCsrfToken('');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv;
  });

  // 1. Unauthenticated Navigation
  describe('Unauthenticated Navigation', () => {
    it('renders unauthenticated navigation with Sign In button and accessible links', () => {
      const html = renderToString(React.createElement(Navbar, {}));

      // Main navigation links exist
      expect(html).toContain('id="nav-dashboard"');
      expect(html).toContain('id="nav-projects"');
      expect(html).toContain('id="nav-tasks"');
      expect(html).toContain('id="nav-copilot"');

      // Unauthenticated action is "Sign In"
      expect(html).toContain('id="nav-signin-btn"');
      expect(html).toContain('Sign In');

      // Crucially: NO user session badge or hardcoded fallbacks in header
      expect(html).not.toContain('id="user-session-badge"');
      expect(html).not.toContain('id="logout-btn"');
    });

    it('does not render misleading hardcoded organization or Director fallbacks in unauthenticated header', () => {
      const html = renderToString(React.createElement(Navbar, {}));
      // Header brand is OpsPilot AI
      expect(html).toContain('OpsPilot AI');
      // The session badge with Acme Operations Corp or Director must NOT be present
      expect(html).not.toContain('id="user-session-badge"');
    });
  });

  // 2. Successful and Failed Login
  describe('Login API Handling (loginUser)', () => {
    it('handles failed login with 401 and returns meaningful error message', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        }),
      });

      const res = await loginUser({
        email: 'invalid@acme.example.com',
        password: 'WrongPassword!',
      });

      expect(res.data).toBeNull();
      expect(res.error).toBe('Invalid email or password');
      expect(getCsrfToken()).toBeNull();
    });

    it('handles successful login and caches CSRF token for cookie-authenticated mutations', async () => {
      const mockCsrfToken = 'mocked-csrf-token-xyz-789';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            user: mockUser,
            organization: mockOrg,
            csrfToken: mockCsrfToken,
          },
        }),
      });

      const res = await loginUser({
        email: 'director@acme.example.com',
        password: 'DemoPass123!',
      });

      expect(res.error).toBeNull();
      expect(res.data).not.toBeNull();
      expect(res.data?.user.email).toBe('director@acme.example.com');
      expect(res.data?.user.role).toBe('Director');
      expect(res.data?.organization.name).toBe('Acme Operations Corp');
      expect(getCsrfToken()).toBe(mockCsrfToken);
    });
  });

  // 3. Session Persistence (getCurrentUser)
  describe('Session Persistence (/api/v1/auth/me)', () => {
    it('returns null and 401 error message when session is absent or expired', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.',
          },
        }),
      });

      const res = await getCurrentUser();

      expect(res.data).toBeNull();
      expect(res.error).toBe('Authentication required. Please log in.');
    });

    it('returns confirmed user and organization when session cookie is valid', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            user: mockUser,
            organization: mockOrg,
          },
        }),
      });

      const res = await getCurrentUser();

      expect(res.error).toBeNull();
      expect(res.data?.user.role).toBe('Director');
      expect(res.data?.organization.name).toBe('Acme Operations Corp');
    });
  });

  // 4. Dashboard Loading After Login
  describe('Dashboard Loading After Login', () => {
    it('transitions from 401 error to active dashboard summary upon authentication', async () => {
      // Step A: Initial unauthenticated request fails
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.',
          },
        }),
      });

      const unauthRes = await fetchDashboardSummary();
      expect(unauthRes.data).toBeNull();
      expect(unauthRes.error).toBe('Authentication required. Please log in.');

      // Step B: Authenticated request succeeds with live PostgreSQL KPI metrics
      const mockSummaryData: DashboardSummaryResponse = {
        kpis: {
          activeProjects: 16,
          overdueTasks: 4,
          blockedProjects: 2,
          pendingApprovals: 5,
          collectionFollowUps: 2,
          totalProjects: 20,
          totalTasks: 45,
          completedTasks: 25,
          taskCompletionRate: 55,
        },
        risks: [
          {
            id: 'risk-1',
            category: 'overdue_task',
            severity: 'critical',
            title: 'Critical Task Overdue',
            explanation: 'Task SLA exceeded',
            sourceRecord: {
              type: 'task',
              id: 'task-1',
              name: 'Security audit',
              status: 'in_progress',
              dueDate: new Date().toISOString(),
              projectId: 'proj-1',
              projectName: 'Audit',
            },
            detectedAt: new Date().toISOString(),
          },
        ],
        statusBreakdown: {
          projects: { active: 16, blocked: 2, completed: 2, paused: 0, archived: 0 },
          tasks: { todo: 10, in_progress: 10, review: 0, blocked: 2, done: 23 },
          tasksByPriority: { urgent: 4, high: 10, medium: 20, low: 11 },
        },
        dateRange: {},
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockSummaryData,
        }),
      });

      const authRes = await fetchDashboardSummary();
      expect(authRes.error).toBeNull();
      expect(authRes.data).not.toBeNull();
      expect(authRes.data?.kpis.activeProjects).toBe(16);
      expect(authRes.data?.kpis.overdueTasks).toBe(4);
      expect(authRes.data?.risks).toHaveLength(1);
    });
  });

  // 5. KPI Empty and Error States
  describe('ExecutiveKpis Empty, Error, and Loading States', () => {
    it('renders skeletons only while loading is true', () => {
      const html = renderToString(
        React.createElement(ExecutiveKpis, { kpis: null, loading: true }),
      );
      expect(html).toContain('id="kpi-loading-skeletons"');
      expect(html).toContain('skeleton');
      expect(html).not.toContain('id="kpi-empty-state"');
      expect(html).not.toContain('id="kpi-active-projects"');
    });

    it('renders meaningful empty or error state when loading is false and KPI data is unavailable', () => {
      const html = renderToString(
        React.createElement(ExecutiveKpis, { kpis: null, loading: false }),
      );
      expect(html).toContain('id="kpi-empty-state"');
      expect(html).toContain('Operational Metrics Unavailable');
      expect(html).toContain(
        'Please authenticate with an authorized account or adjust filter parameters',
      );
      expect(html).not.toContain('id="kpi-loading-skeletons"');
      expect(html).not.toContain('id="kpi-active-projects"');
    });

    it('renders full interactive KPI cards when KPI data is loaded', () => {
      const html = renderToString(
        React.createElement(ExecutiveKpis, {
          kpis: {
            activeProjects: 12,
            overdueTasks: 2,
            blockedProjects: 1,
            pendingApprovals: 3,
            collectionFollowUps: 0,
            totalProjects: 15,
            totalTasks: 30,
            completedTasks: 18,
            taskCompletionRate: 60,
          },
          loading: false,
        }),
      );

      expect(html).not.toContain('id="kpi-empty-state"');
      expect(html).not.toContain('id="kpi-loading-skeletons"');
      expect(html).toContain('id="kpi-active-projects"');
      expect(html).toContain('id="kpi-overdue-tasks"');
      expect(html).toContain('id="kpi-blocked-projects"');
      expect(html).toContain('id="kpi-pending-approvals"');
      expect(html).toContain('id="kpi-collection-followups"');
      expect(html).toContain('12');
      expect(html).toContain('2');
    });
  });
});
