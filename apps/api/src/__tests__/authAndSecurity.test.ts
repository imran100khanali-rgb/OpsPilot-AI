import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { query, pool } from '../db/pool.js';
import { runMigrations } from '../db/migrator.js';

describe('Security & Multi-Tenant Authentication Test Suite', () => {
  const app = createApp();

  beforeAll(async () => {
    // Ensure migrations have run and seed data is present
    await runMigrations();
  });

  afterAll(async () => {
    // Clean up test sessions created during test run
    await query("DELETE FROM sessions WHERE user_agent = 'vitest-security-agent'");
  });

  describe('1. Authentication & Invalid Login Handling', () => {
    it('rejects login with non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost-user@nonexistent.example.com', password: 'SomePassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects login with incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'director@acme.example.com', password: 'IncorrectPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects deactivated user with 401', async () => {
      // Temporarily deactivate a demo user
      await query("UPDATE users SET is_active = false WHERE email = 'manager@globex.example.com'");

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'manager@globex.example.com', password: 'DemoPass123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Account is deactivated');

      // Re-activate user
      await query("UPDATE users SET is_active = true WHERE email = 'manager@globex.example.com'");
    });

    it('validates request payload and rejects invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully logs in synthetic user and returns HTTP-only session cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify cookies
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();

      const sessionCookie = cookies.find((c: string) => c.startsWith('opspilot_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');

      const csrfCookie = cookies.find((c: string) => c.startsWith('opspilot_csrf='));
      expect(csrfCookie).toBeDefined();

      // Verify payload never leaks password_hash or session secrets
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('director@acme.example.com');
      expect(res.body.data.user.role).toBe('Director');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data).not.toHaveProperty('sessionTokenHash');
      expect(res.body.data).toHaveProperty('csrfToken');
    });
  });

  describe('2. Session Expiry & Revocation Handling', () => {
    it('rejects access when session is expired in database', async () => {
      // Create session for testing
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const sessionCookie = cookies.find((c: string) => c.startsWith('opspilot_session='))!;
      const token = sessionCookie.split(';')[0]!.split('=')[1]!;

      // Verify valid session works
      const meResBefore = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);
      expect(meResBefore.status).toBe(200);

      // Force-expire the session in the database
      await query(
        "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 hour' WHERE session_token_hash = encode(sha256($1::bytea), 'hex')",
        [token],
      );

      // Request with expired session should be rejected with 401
      const meResAfter = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);
      expect(meResAfter.status).toBe(401);
      expect(meResAfter.body.error.code).toBe('UNAUTHORIZED');
    });

    it('successfully logs out and invalidates session', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@acme.example.com', password: 'DemoPass123!' });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const sessionCookie = cookies.find((c: string) => c.startsWith('opspilot_session='))!;
      const csrfToken = loginRes.body.data.csrfToken;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', csrfToken);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Subsequent request should fail
      const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);
      expect(meRes.status).toBe(401);
    });
  });

  describe('3. Role-Based Access Control (RBAC) & Privilege Escalation', () => {
    it('prevents Manager from accessing Admin-only endpoint (403 Forbidden)', async () => {
      // Log in as Manager
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'manager@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      const res = await request(app).get('/api/v1/admin/users').set('Cookie', sessionCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Requires one of roles: [Admin]');
    });

    it('prevents Manager from reviewing approvals (requires Director or Admin)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'manager@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;
      const csrfToken = loginRes.body.data.csrfToken;

      const res = await request(app)
        .post('/api/v1/approvals/66666666-6666-6666-6666-666666666661/review')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'approved', notes: 'Manager trying to approve' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Requires one of roles: [Director, Admin]');
    });

    it('allows Director to review approvals successfully', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;
      const csrfToken = loginRes.body.data.csrfToken;

      const res = await request(app)
        .post('/api/v1/approvals/66666666-6666-6666-6666-666666666661/review')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'approved', notes: 'Authorized Director signoff' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.reviewedBy).toBe(loginRes.body.data.user.id);
    });

    it('allows Admin to access Admin-only users list and never exposes password hashes', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      const res = await request(app).get('/api/v1/admin/users').set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify no password hash is returned anywhere in users list
      for (const u of res.body.data) {
        expect(u).not.toHaveProperty('password_hash');
        expect(u).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('4. Multi-Tenant Organization Data Isolation', () => {
    it('isolates project lists: Acme user only sees Acme projects, Globex user only sees Globex projects', async () => {
      // 1. Log in as Acme Director
      const acmeLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

      const acmeCookie = (acmeLogin.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      // 2. Log in as Globex Admin
      const globexLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@globex.example.com', password: 'DemoPass123!' });

      const globexCookie = (globexLogin.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      // Acme fetch
      const acmeProjects = await request(app)
        .get('/api/v1/projects?limit=50')
        .set('Cookie', acmeCookie);
      expect(acmeProjects.status).toBe(200);
      const acmeList = acmeProjects.body.data.items || acmeProjects.body.data;
      const acmeNames = acmeList.map((p: { name: string }) => p.name);
      expect(acmeNames).toContain('Project Apollo Observability');
      expect(acmeNames).not.toContain('Globex Top Secret AI Initiative');

      // Globex fetch
      const globexProjects = await request(app)
        .get('/api/v1/projects?limit=50')
        .set('Cookie', globexCookie);
      expect(globexProjects.status).toBe(200);
      const globexList = globexProjects.body.data.items || globexProjects.body.data;
      const globexNames = globexList.map((p: { name: string }) => p.name);
      expect(globexNames).toContain('Globex Top Secret AI Initiative');
      expect(globexNames).not.toContain('Project Apollo Observability');
    });

    it('strictly blocks cross-organization project access (returns 404 NOT_FOUND)', async () => {
      // Log in as Acme user
      const acmeLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'director@acme.example.com', password: 'DemoPass123!' });

      const acmeCookie = (acmeLogin.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      // Attempt to access Globex project ID '44444444-4444-4444-4444-444444444441'
      const res = await request(app)
        .get('/api/v1/projects/44444444-4444-4444-4444-444444444441')
        .set('Cookie', acmeCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('5. CSRF Protection on Cookie Mutations', () => {
    it('blocks cookie-authenticated mutation when x-csrf-token header is missing (403 Forbidden)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      // Omit x-csrf-token
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', sessionCookie)
        .send({ name: 'CSRF Exploit Project' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Missing CSRF token');
    });

    it('blocks cookie-authenticated mutation when x-csrf-token header is forged/invalid (403 Forbidden)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;

      // Send forged csrf token
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', 'forged-invalid-csrf-secret-1234567890abcdef')
        .send({ name: 'CSRF Exploit Project' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Invalid CSRF token');
    });

    it('allows cookie-authenticated mutation when valid x-csrf-token is presented', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'vitest-security-agent')
        .send({ email: 'admin@acme.example.com', password: 'DemoPass123!' });

      const sessionCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('opspilot_session='),
      )!;
      const csrfToken = loginRes.body.data.csrfToken;

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Authorized Project Creation',
          description: 'Created with valid CSRF token',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Authorized Project Creation');
      expect(res.body.data.organizationId).toBe(loginRes.body.data.organization.id);
    });
  });
});
