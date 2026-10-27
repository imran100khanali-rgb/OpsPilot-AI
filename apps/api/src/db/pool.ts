import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/safeLogger.js';
import { DatabaseError } from '../utils/errors.js';
import { HealthStatus } from '@opspilot/shared';

const { Pool } = pg;

function createPoolConfig(): pg.PoolConfig {
  const baseConfig: pg.PoolConfig = {
    max: env.DB_MAX_CONNECTIONS,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  };

  if (env.DATABASE_URL) {
    return {
      ...baseConfig,
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    ...baseConfig,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  };
}

export const pool = new Pool(createPoolConfig());

// Handle unexpected idle client errors to prevent process crash
pool.on('error', (err: Error) => {
  logger.error('Unexpected idle client error in PostgreSQL pool', {
    error: err.message,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

pool.on('connect', () => {
  logger.debug('New client established in PostgreSQL pool');
});

/**
 * Executes a SQL query with performance instrumentation and error wrapping
 */
export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> {
  const start = performance.now();
  try {
    const res = await pool.query<R>(text, params);
    const duration = Math.round((performance.now() - start) * 100) / 100;

    logger.debug('Executed SQL query', {
      query: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      durationMs: duration,
      rowCount: res.rowCount,
    });

    return res;
  } catch (error) {
    const duration = Math.round((performance.now() - start) * 100) / 100;
    const message = error instanceof Error ? error.message : 'Unknown query error';

    logger.error('Failed to execute SQL query', {
      query: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      durationMs: duration,
      error: message,
    });

    throw new DatabaseError(`Database query failed: ${message}`);
  }
}

/**
 * Health check querying the database with latency measurement
 */
export async function checkDbHealth(): Promise<{
  status: HealthStatus;
  latencyMs: number;
  message?: string;
}> {
  const start = performance.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS ping');
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        status: latencyMs > 500 ? 'degraded' : 'healthy',
        latencyMs,
        message: 'PostgreSQL connection operational',
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      status: 'unhealthy',
      latencyMs,
      message,
    };
  }
}

/**
 * Gracefully drains and closes the PostgreSQL pool
 */
export async function closePool(): Promise<void> {
  try {
    logger.info('Draining PostgreSQL connection pool...');
    await pool.end();
    logger.info('PostgreSQL connection pool drained successfully.');
  } catch (error) {
    logger.error('Error while closing PostgreSQL pool', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
