-- OpsPilot AI: Rollback Migration 004
DROP TABLE IF EXISTS collections CASCADE;
ALTER TABLE tasks DROP COLUMN IF EXISTS due_date;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'archived', 'paused'));
