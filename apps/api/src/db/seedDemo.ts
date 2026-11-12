import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './pool.js';
import { logger } from '../utils/safeLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedDemoData(): Promise<void> {
  const seedSqlPath = path.join(__dirname, 'seeds', 'ibirds_demo_seed.sql');

  if (!fs.existsSync(seedSqlPath)) {
    throw new Error(`Seed SQL file not found at: ${seedSqlPath}`);
  }

  const sqlContent = fs.readFileSync(seedSqlPath, 'utf8');

  logger.info('Executing iBirds synthetic demo seed script...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    logger.info('Successfully applied iBirds synthetic demo organization and records.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to seed demo data', { error: (err as Error)?.message });
    throw err;
  } finally {
    client.release();
  }
}

// If executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seedDemo.ts')) {
  seedDemoData()
    .then(async () => {
      const res = await query(
        `SELECT id, name, slug FROM organizations WHERE slug = 'ibirds-services'`,
      );
      console.log('Seed verification successful:', res.rows[0]);
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed execution error:', err);
      await pool.end();
      process.exit(1);
    });
}
