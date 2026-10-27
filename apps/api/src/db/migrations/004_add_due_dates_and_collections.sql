-- OpsPilot AI: Migration 004 - Due Dates, Collections, and Executive Intelligence Data

-- 1. Add due_date to tasks if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 2. Update projects status check constraint to include 'blocked'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'archived', 'paused', 'blocked'));

-- 3. Collections & Accounts Receivable Follow-ups
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'overdue', 'paid', 'escalated')),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collections_org ON collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_due_date ON collections(due_date);
CREATE INDEX IF NOT EXISTS idx_collections_follow_up ON collections(follow_up_date);

-- 4. Seed Synthetic Records for Acme Operations Corp (11111111-1111-1111-1111-111111111111)

-- Additional Projects
INSERT INTO projects (id, organization_id, name, description, status, created_by, created_at)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Cloud Migration Phase 2', 'Core database migration to multi-region cloud cluster', 'blocked', '10000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP - INTERVAL '25 days'),
  ('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', 'Q3 SOC2 Compliance Audit', 'Annual security certifications and penetration tests', 'completed', '10000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '60 days')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- Update existing tasks with deterministic due dates
UPDATE tasks
SET due_date = CURRENT_TIMESTAMP - INTERVAL '4 days'
WHERE id = '55555555-5555-5555-5555-555555555551';

-- Additional Tasks (Overdue, Blocked, In-Progress, Done)
INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, due_date, assigned_to, created_by, created_at)
VALUES
  (
    '55555555-5555-5555-5555-555555555552',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'PostgreSQL Read Replica Failover Test',
    'Conduct automated failover simulation across availability zones',
    'blocked',
    'urgent',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  ),
  (
    '55555555-5555-5555-5555-555555555553',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333331',
    'Setup Ingress TLS Certificates',
    'Automate certificate renewal via Let''s Encrypt and cert-manager',
    'in_progress',
    'medium',
    CURRENT_TIMESTAMP + INTERVAL '6 days',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '5 days'
  ),
  (
    '55555555-5555-5555-5555-555555555554',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333332',
    'Zero-Trust Network Policy Audit',
    'Verify pod-to-pod ingress/egress rules and Calico policies',
    'done',
    'high',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '15 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Additional Approvals
INSERT INTO approvals (id, organization_id, requested_by, title, status, notes, created_at)
VALUES
  (
    '66666666-6666-6666-6666-666666666662',
    '11111111-1111-1111-1111-111111111111',
    '10000000-0000-0000-0000-000000000003',
    'Emergency Production Firewall Port Modification',
    'pending',
    'Requesting Director signoff to whitelist external webhook callback IP range',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Collections for Acme Corp
INSERT INTO collections (id, organization_id, customer_name, invoice_number, amount, currency, status, due_date, follow_up_date, notes)
VALUES
  (
    '77777777-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Omni Retail Enterprises',
    'INV-2026-089',
    42500.00,
    'USD',
    'overdue',
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    'Second reminder sent. Awaiting accounts payable approval.'
  ),
  (
    '77777777-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Skyline Freight & Logistics',
    'INV-2026-094',
    18200.00,
    'USD',
    'pending',
    CURRENT_TIMESTAMP + INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    'Initial payment notice sent. Follow-up scheduled prior to due date.'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Separate Records for Globex Ltd (Tenant Isolation Testing)
INSERT INTO collections (id, organization_id, customer_name, invoice_number, amount, currency, status, due_date, follow_up_date, notes)
VALUES
  (
    '77777777-9999-9999-9999-999999999999',
    '22222222-2222-2222-2222-222222222222',
    'Globex Secret Partner Corp',
    'INV-GLX-001',
    95000.00,
    'USD',
    'pending',
    CURRENT_TIMESTAMP + INTERVAL '10 days',
    CURRENT_TIMESTAMP + INTERVAL '5 days',
    'Confidential Globex contract invoice'
  )
ON CONFLICT (id) DO NOTHING;
