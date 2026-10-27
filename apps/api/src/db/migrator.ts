import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { pool } from './pool.js';
import { logger } from '../utils/safeLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface AppliedMigration {
  id: number;
  name: string;
  checksum: string;
  applied_at: Date;
}

function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Ensures the schema_migrations tracking table exists
 */
export async function ensureMigrationsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Fetches all applied migrations ordered by ID
 */
export async function getAppliedMigrations(): Promise<Map<string, AppliedMigration>> {
  await ensureMigrationsTable();
  const res = await pool.query<AppliedMigration>(
    'SELECT id, name, checksum, applied_at FROM schema_migrations ORDER BY id ASC',
  );
  const map = new Map<string, AppliedMigration>();
  for (const row of res.rows) {
    map.set(row.name, row);
  }
  return map;
}

/**
 * Reads and sorts forward (.sql, non-.down.sql) migration files from the migrations folder
 */
export function getMigrationFiles(): {
  name: string;
  fullPath: string;
  content: string;
  checksum: string;
}[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .sort();

  return files.map((name) => {
    const fullPath = path.join(MIGRATIONS_DIR, name);
    const content = fs.readFileSync(fullPath, 'utf8');
    const checksum = computeChecksum(content);
    return { name, fullPath, content, checksum };
  });
}

/**
 * Applies all pending migrations within individual transactions
 */
export async function runMigrations(): Promise<{ applied: string[]; upToDate: boolean }> {
  logger.info('Starting database migration runner...');

  await ensureMigrationsTable();
  const appliedMap = await getAppliedMigrations();
  const migrationFiles = getMigrationFiles();

  const newlyApplied: string[] = [];

  for (const migration of migrationFiles) {
    const alreadyApplied = appliedMap.get(migration.name);

    if (alreadyApplied) {
      if (alreadyApplied.checksum !== migration.checksum) {
        logger.warn(
          `Checksum mismatch for applied migration '${migration.name}'. File may have been modified after execution.`,
          { expected: alreadyApplied.checksum, actual: migration.checksum },
        );
      }
      continue;
    }

    logger.info(`Applying migration: ${migration.name}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.content);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
        migration.name,
        migration.checksum,
      ]);
      await client.query('COMMIT');

      newlyApplied.push(migration.name);
      logger.info(`Successfully applied migration: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration '${migration.name}' failed. Transaction rolled back.`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  if (newlyApplied.length === 0) {
    logger.info('Database schema is already up to date. No pending migrations.');
    return { applied: [], upToDate: true };
  }

  logger.info(`Database migration completed. Applied ${newlyApplied.length} migration(s).`);
  return { applied: newlyApplied, upToDate: false };
}

/**
 * Rolls back the most recently applied migration using its .down.sql companion
 */
export async function rollbackLastMigration(): Promise<{ rolledBack: string | null }> {
  logger.info('Initiating migration rollback...');
  await ensureMigrationsTable();

  const res = await pool.query<AppliedMigration>(
    'SELECT id, name FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );

  if (res.rows.length === 0) {
    logger.info('No migrations have been applied. Nothing to rollback.');
    return { rolledBack: null };
  }

  const lastMigration = res.rows[0]!;
  const baseName = lastMigration.name.replace(/\.sql$/, '');
  const downFileName = `${baseName}.down.sql`;
  const downFilePath = path.join(MIGRATIONS_DIR, downFileName);

  if (!fs.existsSync(downFilePath)) {
    const msg = `Rollback script '${downFileName}' not found for applied migration '${lastMigration.name}'.`;
    logger.error(msg);
    throw new Error(msg);
  }

  const downSql = fs.readFileSync(downFilePath, 'utf8');
  logger.info(`Executing rollback script: ${downFileName}...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(downSql);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [lastMigration.id]);
    await client.query('COMMIT');

    logger.info(`Successfully rolled back migration: ${lastMigration.name}`);
    return { rolledBack: lastMigration.name };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Rollback failed for '${lastMigration.name}'. Transaction rolled back.`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Displays current migration status
 */
export async function migrationStatus(): Promise<void> {
  const appliedMap = await getAppliedMigrations();
  const migrationFiles = getMigrationFiles();

  console.log('\n--- Database Migration Status ---');
  if (migrationFiles.length === 0) {
    console.log('No migration files found in migrations directory.');
    return;
  }

  for (const file of migrationFiles) {
    const applied = appliedMap.get(file.name);
    const downExists = fs.existsSync(file.fullPath.replace(/\.sql$/, '.down.sql'));
    const rollbackIndicator = downExists ? '[Rollback Available]' : '[No Down Script]';

    if (applied) {
      console.log(
        `[APPLIED]  ${file.name} (Applied at: ${new Date(applied.applied_at).toLocaleString()}) ${rollbackIndicator}`,
      );
    } else {
      console.log(`[PENDING]  ${file.name} ${rollbackIndicator}`);
    }
  }
  console.log('---------------------------------\n');
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] || 'migrate';

  (async () => {
    try {
      if (command === 'status') {
        await migrationStatus();
      } else if (command === 'migrate') {
        await runMigrations();
      } else if (command === 'rollback') {
        await rollbackLastMigration();
      } else {
        console.error(`Unknown command: ${command}. Use 'migrate', 'rollback', or 'status'.`);
        process.exit(1);
      }
      await pool.end();
      process.exit(0);
    } catch (err) {
      logger.fatal('Migration execution halted with error', {
        error: err instanceof Error ? err.message : String(err),
      });
      await pool.end();
      process.exit(1);
    }
  })();
}
