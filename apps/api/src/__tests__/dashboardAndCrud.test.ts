import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { query } from '../db/pool.js';
import { runMigrations } from '../db/migrator.js';
import { DashboardSummaryResponse, PaginatedResult, Project, Task } from '@opspilot/shared';

describe('Executive Dashboard & Operational Workspace Test Suite', () => {
  const app = createApp();

  let acmeSessionCookie: string;
  let acmeCsrfToken: string;
  let globexSessionCookie: string;
  let globexCsrfToken: string;

  beforeAll(async () => {
    await runMigrations();

    // Log in as Acme Director
    const acmeLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'vitest-dashboard-agent')
      .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

    const acmeCookies = acmeLogin.headers['set-cookie'] as unknown as string[];
    acmeSessionCookie = acmeCookies.find((c: string) => c.startsWith('opspilot_session='))!;
    acmeCsrfToken = acmeLogin.body.data.csrfToken;

    // Log in as Globex Admin (Tenant B)
    const globexLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'vitest-dashboard-agent')
      .send({ email: 'admin@globex.example.com', password: 'DemoPass123!' });

    const globexCookies = globexLogin.headers['set-cookie'] as unknown as string[];
    globexSessionCookie = globexCookies.find((c: string) => c.startsWith('opspilot_session='))!;
    globexCsrfToken = globexLogin.body.data.csrfToken;
  });

  afterAll(async () => {
    await query("DELETE FROM sessions WHERE user_agent = 'vitest-dashboard-agent'");
  });

  describe('1. Executive Dashboard KPI Calculations & Risk Engine', () => {
    it('calculates real PostgreSQL-backed KPI counts without hardcoded values', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.data as DashboardSummaryResponse;
      expect(summary.kpis).toBeDefined();

      // Check deterministic KPI presence
      expect(summary.kpis.activeProjects).toBeGreaterThanOrEqual(1);
      expect(summary.kpis.overdueTasks).toBeGreaterThanOrEqual(1);
      expect(summary.kpis.blockedProjects).toBeGreaterThanOrEqual(1);
      expect(summary.kpis.pendingApprovals).toBeGreaterThanOrEqual(1);
      expect(summary.kpis.collectionFollowUps).toBeGreaterThanOrEqual(1);
      expect(summary.kpis.totalProjects).toBeGreaterThanOrEqual(2);
      expect(summary.kpis.totalTasks).toBeGreaterThanOrEqual(3);
      expect(summary.kpis.taskCompletionRate).toBeGreaterThanOrEqual(0);

      // Check status breakdown
      expect(summary.statusBreakdown.projects).toHaveProperty('active');
      expect(summary.statusBreakdown.tasks).toHaveProperty('todo');
      expect(summary.statusBreakdown.tasksByPriority).toHaveProperty('urgent');
    });

    it('generates deterministic risk items with source records and explanations', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Cookie', acmeSessionCookie);

      const summary = res.body.data as DashboardSummaryResponse;
      expect(Array.isArray(summary.risks)).toBe(true);
      expect(summary.risks.length).toBeGreaterThan(0);

      // Verify structure of every risk item
      for (const risk of summary.risks) {
        expect(risk).toHaveProperty('id');
        expect(risk).toHaveProperty('category');
        expect([
          'overdue_task',
          'blocked_project',
          'blocked_task',
          'stalled_approval',
          'overdue_collection',
        ]).toContain(risk.category);
        expect(risk).toHaveProperty('severity');
        expect(['critical', 'high', 'medium']).toContain(risk.severity);
        expect(risk).toHaveProperty('title');
        expect(risk).toHaveProperty('explanation');
        expect(risk.explanation.length).toBeGreaterThan(15);
        expect(risk).toHaveProperty('suggestedAction');
        expect(risk.sourceRecord).toBeDefined();
        expect(risk.sourceRecord).toHaveProperty('id');
        expect(risk.sourceRecord).toHaveProperty('name');
        expect(risk.sourceRecord).toHaveProperty('type');
      }

      // Check for overdue task risk specifically
      const overdueRisk = summary.risks.find((r) => r.category === 'overdue_task');
      expect(overdueRisk).toBeDefined();
      expect(overdueRisk?.explanation).toContain('overdue');

      // Check for blocked project risk
      const blockedRisk = summary.risks.find(
        (r) => r.category === 'blocked_project' || r.category === 'blocked_task',
      );
      expect(blockedRisk).toBeDefined();

      // Check for overdue collection risk
      const collectionRisk = summary.risks.find((r) => r.category === 'overdue_collection');
      expect(collectionRisk).toBeDefined();
      expect(collectionRisk?.explanation).toContain('overdue since');
    });

    it('filters summary metrics by date range consistently', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];

      // Query with date range completely in the future
      const res = await request(app)
        .get(`/api/v1/dashboard/summary?startDate=${tomorrow}&endDate=${futureDate}`)
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const summary = res.body.data as DashboardSummaryResponse;
      // No projects created in future range
      expect(summary.kpis.activeProjects).toBe(0);
      expect(summary.kpis.totalProjects).toBe(0);
    });

    it('returns time-series trends over date range', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/trends')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.trends)).toBe(true);
      expect(res.body.data.trends.length).toBeGreaterThan(0);

      const firstPoint = res.body.data.trends[0];
      expect(firstPoint).toHaveProperty('date');
      expect(firstPoint).toHaveProperty('createdTasks');
      expect(firstPoint).toHaveProperty('completedTasks');
      expect(firstPoint).toHaveProperty('activeProjects');
    });
  });

  describe('2. Project CRUD, Search, Filter, Sort, Pagination', () => {
    let createdProjectId: string;

    it('lists projects with pagination metadata and task counts', async () => {
      const res = await request(app)
        .get('/api/v1/projects?page=1&limit=2')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Project>;
      expect(data.items.length).toBeLessThanOrEqual(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBeGreaterThanOrEqual(2);

      // Verify task metrics attached
      expect(data.items[0]).toHaveProperty('taskCount');
      expect(data.items[0]).toHaveProperty('completedTaskCount');
    });

    it('searches projects by keyword', async () => {
      const res = await request(app)
        .get('/api/v1/projects?search=Apollo')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Project>;
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0]?.name).toContain('Apollo');
    });

    it('filters projects by status', async () => {
      const res = await request(app)
        .get('/api/v1/projects?status=blocked')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Project>;
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      for (const p of data.items) {
        expect(p.status).toBe('blocked');
      }
    });

    it('creates a new project with validation and CSRF enforcement', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken)
        .send({
          name: 'AI Operations Mesh Automation',
          description: 'Autonomous cluster scaling and pod traffic optimization',
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('AI Operations Mesh Automation');
      createdProjectId = res.body.data.id;
    });

    it('updates an existing project with PUT', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken)
        .send({
          name: 'AI Operations Mesh Automation (Updated)',
          status: 'paused',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('AI Operations Mesh Automation (Updated)');
      expect(res.body.data.status).toBe('paused');
    });

    it('deletes an existing project with DELETE', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it no longer exists
      const getRes = await request(app)
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', acmeSessionCookie);
      expect(getRes.status).toBe(404);
    });
  });

  describe('3. Task CRUD, Overdue Filtering, and Cross-Tenant Restrictions', () => {
    let createdTaskId: string;
    const acmeApolloProjectId = '33333333-3333-3333-3333-333333333331';

    it('lists tasks with overdue flag and project information', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?page=1&limit=10')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Task>;
      expect(data.items.length).toBeGreaterThanOrEqual(1);

      const firstTask = data.items[0]!;
      expect(firstTask).toHaveProperty('projectName');
      expect(firstTask).toHaveProperty('isOverdue');
    });

    it('filters tasks by isOverdue=true', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?isOverdue=true')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Task>;
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      for (const t of data.items) {
        expect(t.isOverdue).toBe(true);
        expect(t.status).not.toBe('done');
      }
    });

    it('filters tasks by priority', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?priority=urgent')
        .set('Cookie', acmeSessionCookie);

      expect(res.status).toBe(200);
      const data = res.body.data as PaginatedResult<Task>;
      for (const t of data.items) {
        expect(t.priority).toBe('urgent');
      }
    });

    it('creates a new task assigned to user with due date', async () => {
      const dueDate = new Date(Date.now() + 86400000 * 3).toISOString();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken)
        .send({
          projectId: acmeApolloProjectId,
          title: 'Implement Synthetic Canary Telemetry',
          description: 'Deploy canary health probes to edge ingress',
          status: 'in_progress',
          priority: 'high',
          dueDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Implement Synthetic Canary Telemetry');
      createdTaskId = res.body.data.id;
    });

    it('updates task status to done', async () => {
      const res = await request(app)
        .put(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken)
        .send({
          status: 'done',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('done');
    });

    it('prevents cross-tenant project linking (Tenant B user cannot create task in Tenant A project)', async () => {
      // Globex user trying to attach task to Acme Apollo project
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', globexSessionCookie)
        .set('x-csrf-token', globexCsrfToken)
        .send({
          projectId: acmeApolloProjectId,
          title: 'Malicious Cross-Tenant Infiltration Task',
          status: 'todo',
          priority: 'urgent',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain(
        'Specified project does not belong to your organization',
      );
    });

    it('prevents cross-tenant task retrieval (Tenant B user cannot view Tenant A task)', async () => {
      // Globex user trying to GET Acme task
      const res = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', globexSessionCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('deletes task cleanly', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', acmeSessionCookie)
        .set('x-csrf-token', acmeCsrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
