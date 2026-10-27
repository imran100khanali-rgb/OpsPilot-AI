-- OpsPilot AI: Migration 003 - Multi-tenant Authentication & Operations Intelligence Tables

-- 1. Organizations (Multi-tenant Root)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(60) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- 2. Users (Scoped to Organization)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('Director', 'Manager', 'Admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Sessions (Server-side Session Storage with Hashed Tokens and CSRF Secrets)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  csrf_secret VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 4. Projects (Organization-scoped)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 5. Tasks (Organization-scoped within Projects)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 6. Approvals (Organization-scoped Governance)
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approvals_org ON approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);

-- 7. AI Conversations (Organization-scoped)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL DEFAULT 'opspilot-ai-core',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_org ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

-- 8. AI Messages (Threaded within AI Conversations)
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_org ON ai_messages(organization_id);

-- 9. Action Runs (Automated Operations Workflows)
CREATE TABLE IF NOT EXISTS action_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'failed', 'cancelled')),
  input_payload JSONB,
  output_payload JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_runs_org ON action_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_status ON action_runs(status);

-- 10. Audit Logs (Enterprise Compliance Trail)
-- Drop existing un-scoped audit_logs if any from migration 002 and recreate with organization scope
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  ip_address VARCHAR(45),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 11. Notifications (Alerts & System Notices)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'critical')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- Synthetic Demo Data Seeding
-- Passwords hashed via bcrypt (12 rounds) for 'DemoPass123!': $2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS

-- Organization 1: Acme Operations Corp
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Operations Corp', 'acme-corp')
ON CONFLICT (slug) DO NOTHING;

-- Organization 2: Globex Intelligence Ltd
INSERT INTO organizations (id, name, slug)
VALUES ('22222222-2222-2222-2222-222222222222', 'Globex Intelligence Ltd', 'globex-ltd')
ON CONFLICT (slug) DO NOTHING;

-- Users for Acme Operations Corp
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'director@acme.example.com', '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS', 'Diana', 'Director', 'Director'),
  ('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'manager@acme.example.com', '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS', 'Marcus', 'Manager', 'Manager'),
  ('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'admin@acme.example.com', '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS', 'Alex', 'Admin', 'Admin')
ON CONFLICT (email) DO NOTHING;

-- Users for Globex Intelligence Ltd (Tenant Isolation Verification)
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
VALUES
  ('20000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin@globex.example.com', '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS', 'Gwen', 'GlobexAdmin', 'Admin'),
  ('20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'manager@globex.example.com', '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS', 'Gary', 'GlobexManager', 'Manager')
ON CONFLICT (email) DO NOTHING;

-- Seed Projects for Acme Corp
INSERT INTO projects (id, organization_id, name, description, status, created_by)
VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Project Apollo Observability', 'Next-gen distributed tracing and incident auto-remediation', 'active', '10000000-0000-0000-0000-000000000003'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Kubernetes Cluster Hardening', 'Zero-trust network policies and vulnerability scanning', 'active', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Seed Projects for Globex Ltd (To verify Cross-Tenant Access is strictly blocked)
INSERT INTO projects (id, organization_id, name, description, status, created_by)
VALUES
  ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222222222', 'Globex Top Secret AI Initiative', 'Confidential intelligence algorithms for Globex operations', 'active', '20000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Seed Tasks for Acme Apollo Project
INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, assigned_to, created_by)
VALUES
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Configure OpenTelemetry Collectors', 'Deploy telemetry sidecars across production pods', 'in_progress', 'high', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Seed Approvals (Requiring Director or Admin Review)
INSERT INTO approvals (id, organization_id, task_id, requested_by, title, status, notes)
VALUES
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', '10000000-0000-0000-0000-000000000002', 'Production Mesh Traffic Migration Approval', 'pending', 'Requesting Director sign-off on 100% traffic shift')
ON CONFLICT (id) DO NOTHING;

-- Seed AI Conversations
INSERT INTO ai_conversations (id, organization_id, user_id, title, model)
VALUES
  ('77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'High Latency Diagnostic Session', 'opspilot-ai-core')
ON CONFLICT (id) DO NOTHING;

-- Seed AI Messages
INSERT INTO ai_messages (id, conversation_id, organization_id, sender_type, content, tokens_used)
VALUES
  ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', 'user', 'Analyze cluster ingress latency spikes at 14:00 UTC.', 12),
  ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', 'assistant', 'OpsPilot AI detected a connection pool leak in telemetry-pipeline. Pool size was increased to 40 connections.', 45)
ON CONFLICT (id) DO NOTHING;

-- Seed Notifications
INSERT INTO notifications (id, organization_id, user_id, title, message, type, is_read)
VALUES
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Approval Request Pending', 'Marcus Manager submitted a new approval request for Production Mesh Traffic Migration.', 'warning', false)
ON CONFLICT (id) DO NOTHING;
