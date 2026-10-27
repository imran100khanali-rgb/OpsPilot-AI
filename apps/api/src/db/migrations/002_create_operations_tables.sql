-- OpsPilot AI: Migration 002 - Core Operations Intelligence Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Monitored Enterprise Systems
CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'outage', 'maintenance')),
  environment VARCHAR(20) NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_systems_status ON systems(status);
CREATE INDEX IF NOT EXISTS idx_systems_env ON systems(environment);

-- Real-time & Historical Operations Metrics
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit VARCHAR(20) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_system_recorded ON metrics(system_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);

-- Incidents & AI Diagnostics
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  ai_summary TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_incidents_status_severity ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_system ON incidents(system_id);

-- Operational Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(100) NOT NULL DEFAULT 'system',
  resource VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Seed Initial Enterprise Systems (idempotent ON CONFLICT)
INSERT INTO systems (id, name, slug, description, status, environment)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Authentication Gateway', 'auth-gateway', 'Core OAuth2 and JWT session verification cluster', 'operational', 'production'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Payment Processing Engine', 'payment-engine', 'PCI-DSS transaction routing and settlement service', 'operational', 'production'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Telemetry Ingestion Pipeline', 'telemetry-pipeline', 'High-throughput Kafka and streaming metrics aggregator', 'operational', 'production'),
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'OpsPilot AI Diagnostic Worker', 'ai-diagnostic-worker', 'Autonomous incident triage and root cause analyzer', 'operational', 'production')
ON CONFLICT (slug) DO NOTHING;
