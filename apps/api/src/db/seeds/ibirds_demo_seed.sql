-- ============================================================================
-- iBirds AI Delivery Intelligence: Dedicated Synthetic Demo Organization
-- Tenant: iBirds Software Services (ibirds-services)
-- Safe, isolated synthetic records for Salesforce consulting demonstration.
-- ============================================================================

-- 1. Create Dedicated Demo Organization
INSERT INTO organizations (id, name, slug)
VALUES ('33333333-1111-1111-1111-111111111111', 'iBirds Software Services', 'ibirds-services')
ON CONFLICT (slug) DO NOTHING;

-- 2. Users for iBirds Software Services (Password: 'DemoPass123!')
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '33333333-1111-1111-1111-111111111111',
    'lead@ibirds.example.com',
    '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS',
    'Imran',
    'DeliveryLead',
    'Director'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '33333333-1111-1111-1111-111111111111',
    'pm@ibirds.example.com',
    '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS',
    'Priya',
    'ProjectManager',
    'Manager'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '33333333-1111-1111-1111-111111111111',
    'architect@ibirds.example.com',
    '$2b$12$Hpvg..4J2QAfKBONLUe67.yBX0Jf9bPhBKiuhTWMI926NwihpVrfS',
    'Arjun',
    'CloudArchitect',
    'Admin'
  )
ON CONFLICT (email) DO NOTHING;

-- 3. Dedicated Synthetic Salesforce Consulting Projects
INSERT INTO projects (id, organization_id, name, description, status, created_by)
VALUES
  -- Project 1: RED (Urgent blocker on HL7 FHIR API + Deliverable overdue >7 days)
  (
    'a1111111-1111-1111-1111-111111111111',
    '33333333-1111-1111-1111-111111111111',
    'Health Cloud — Patient 360 Rollout',
    'Clinical EHR integration, patient consent tracking, and HIPAA-compliant MuleSoft pipelines for regional hospital network.',
    'active',
    '30000000-0000-0000-0000-000000000001'
  ),
  -- Project 2: AMBER (Release approval pending >48h + Overdue deliverable 3 days)
  (
    'a2222222-2222-2222-2222-222222222222',
    '33333333-1111-1111-1111-111111111111',
    'Salesforce CPQ & Billing Migration',
    'Legacy Apttus CPQ migration to Salesforce Revenue Cloud with multi-currency pricing calculators and DocuSign integration.',
    'active',
    '30000000-0000-0000-0000-000000000002'
  ),
  -- Project 3: AMBER (Non-urgent dependency blocker awaiting sandbox refresh)
  (
    'a3333333-3333-3333-3333-333333333333',
    '33333333-1111-1111-1111-111111111111',
    'Service Cloud — Omni-Channel Integration',
    'Amazon Connect telephony CTI integration, intelligent skill-based routing, and Einstein bot conversational deflection.',
    'active',
    '30000000-0000-0000-0000-000000000002'
  ),
  -- Project 4: GREEN (Clean delivery: 0 blockers, 0 overdue, 0 aging approvals)
  (
    'a4444444-4444-4444-4444-444444444444',
    '33333333-1111-1111-1111-111111111111',
    'Financial Services Cloud Portal',
    'Experience Cloud wealth management client portal, FSC data model onboarding, and portfolio rebalancing workflows.',
    'active',
    '30000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Tasks & Deliverables for Synthetic Projects
INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, due_date, assigned_to, created_by, created_at)
VALUES
  -- Tasks for Health Cloud (RED)
  (
    'b1111111-1111-1111-1111-111111111101',
    '33333333-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'MuleSoft HL7 FHIR API Gateway Connector',
    'Establish bi-directional EHR synchronization with Epic Care Everywhere API. Blocked by hospital VPN cert expiration.',
    'blocked',
    'urgent',
    CURRENT_TIMESTAMP - INTERVAL '8 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '20 days'
  ),
  (
    'b1111111-1111-1111-1111-111111111102',
    '33333333-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'Patient Consent & Opt-Out Screen Flow',
    'LWC wizard allowing patients to manage clinical trial data sharing preferences.',
    'in_progress',
    'high',
    CURRENT_TIMESTAMP + INTERVAL '4 days',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '15 days'
  ),
  (
    'b1111111-1111-1111-1111-111111111103',
    '33333333-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'HIPAA Field Audit Trail Configuration',
    'Configure 10-year historical audit trail archive on Clinical Encounter and Observation objects.',
    'done',
    'medium',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '25 days'
  ),

  -- Tasks for Salesforce CPQ & Billing (AMBER)
  (
    'b2222222-2222-2222-2222-222222222201',
    '33333333-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'Custom LWC CPQ Price Rule Calculator',
    'Implement tiered discount volume engine with multi-currency conversion plugins.',
    'review',
    'high',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '12 days'
  ),
  (
    'b2222222-2222-2222-2222-222222222202',
    '33333333-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'Contract Renewal & Asset Line Item Auto-Sync',
    'Apex batch job to automate evergreen and co-termed asset contract renewals.',
    'in_progress',
    'medium',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  ),
  (
    'b2222222-2222-2222-2222-222222222203',
    '33333333-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222',
    'Product Catalog Data Migration Script',
    'ETL script mapping 1,400 legacy SKU bundles into Salesforce Product2 and PricebookEntry.',
    'done',
    'high',
    CURRENT_TIMESTAMP - INTERVAL '5 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ),

  -- Tasks for Service Cloud (AMBER)
  (
    'b3333333-3333-3333-3333-333333333301',
    '33333333-1111-1111-1111-111111111111',
    'a3333333-3333-3333-3333-333333333333',
    'Amazon Connect CTI Call Control Panel',
    'Embed softphone WebRTC adapter into Service Cloud Voice console. Blocked awaiting sandbox refresh.',
    'blocked',
    'medium',
    CURRENT_TIMESTAMP + INTERVAL '5 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '14 days'
  ),
  (
    'b3333333-3333-3333-3333-333333333302',
    '33333333-1111-1111-1111-111111111111',
    'a3333333-3333-3333-3333-333333333333',
    'Einstein Case Routing & Classification Rules',
    'ML intent model auto-tagging case categories and routing tier-3 escalations.',
    'in_progress',
    'high',
    CURRENT_TIMESTAMP + INTERVAL '9 days',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  ),

  -- Tasks for Financial Services Cloud (GREEN)
  (
    'b4444444-4444-4444-4444-444444444401',
    '33333333-1111-1111-1111-111111111111',
    'a4444444-4444-4444-4444-444444444444',
    'Financial Account Rollup Summaries',
    'Implement custom rollup calculations across joint household accounts and trusts.',
    'in_progress',
    'medium',
    CURRENT_TIMESTAMP + INTERVAL '12 days',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '10 days'
  ),
  (
    'b4444444-4444-4444-4444-444444444402',
    '33333333-1111-1111-1111-111111111111',
    'a4444444-4444-4444-4444-444444444444',
    'Experience Cloud Portfolio Rebalancing Portal',
    'Client-facing portal with real-time portfolio performance charts and advisor chat.',
    'done',
    'high',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '22 days'
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Approvals (Demonstrating Stalled vs On-Track Approvals)
INSERT INTO approvals (id, organization_id, task_id, requested_by, title, status, notes, created_at)
VALUES
  -- Aging Approval (>48 Hours SLA breached - 3 days pending)
  (
    'c2222222-2222-2222-2222-222222222201',
    '33333333-1111-1111-1111-111111111111',
    'b2222222-2222-2222-2222-222222222201',
    '30000000-0000-0000-0000-000000000003',
    'CPQ Tier-1 Discount Override & Pricing Plugin Signoff',
    'pending',
    'Requesting Director sign-off on custom volume pricing tier rules before deployment to UAT.',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  ),
  -- Fresh Approval (Within 48h SLA - 8 hours pending)
  (
    'c1111111-1111-1111-1111-111111111101',
    '33333333-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111102',
    '30000000-0000-0000-0000-000000000002',
    'Health Cloud Clinical Consent Screen Release Gate',
    'pending',
    'Standard QA sign-off for Consent screen release to staging sandbox.',
    CURRENT_TIMESTAMP - INTERVAL '8 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Collections & Receivables
INSERT INTO collections (id, organization_id, customer_name, invoice_number, amount, currency, status, due_date, follow_up_date, notes)
VALUES
  (
    'd1111111-1111-1111-1111-111111111101',
    '33333333-1111-1111-1111-111111111111',
    'Memorial Regional Healthcare System',
    'INV-IBIRDS-041',
    64000.00,
    'USD',
    'overdue',
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    'Milestone 2 signoff achieved. Payment pending hospital finance disbursement.'
  ),
  (
    'd2222222-2222-2222-2222-222222222201',
    '33333333-1111-1111-1111-111111111111',
    'Apex Global Wealth Partners',
    'INV-IBIRDS-045',
    38500.00,
    'USD',
    'pending',
    CURRENT_TIMESTAMP + INTERVAL '14 days',
    CURRENT_TIMESTAMP + INTERVAL '5 days',
    'Phase 1 portal delivery retainer invoice. On schedule.'
  )
ON CONFLICT (id) DO NOTHING;
