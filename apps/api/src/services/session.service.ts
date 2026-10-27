import crypto from 'crypto';
import { query } from '../db/pool.js';
import { User, Organization } from '@opspilot/shared';
import { logger } from '../utils/safeLogger.js';

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionRecord {
  id: string;
  userId: string;
  organizationId: string;
  csrfSecret: string;
  expiresAt: Date;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ValidatedSession {
  session: SessionRecord;
  user: User;
  organization: Organization;
  authMethod: 'cookie' | 'bearer';
}

/**
 * Computes SHA-256 hash of a raw session token to ensure session secrets
 * are never stored plaintext in PostgreSQL.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Creates a new secure server-side session
 */
export async function createSession(params: {
  userId: string;
  organizationId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ rawToken: string; csrfToken: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const csrfSecret = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await query(
    `INSERT INTO sessions (
       session_token_hash, user_id, organization_id, csrf_secret, expires_at, user_agent, ip_address
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      tokenHash,
      params.userId,
      params.organizationId,
      csrfSecret,
      expiresAt.toISOString(),
      params.userAgent || null,
      params.ipAddress || null,
    ],
  );

  logger.info('Created new user session', {
    userId: params.userId,
    organizationId: params.organizationId,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    rawToken,
    csrfToken: csrfSecret,
    expiresAt,
  };
}

/**
 * Validates a session by raw token. Verifies expiration, active status,
 * and updates last_active_at timestamp.
 */
export async function validateSession(
  rawToken: string,
  authMethod: 'cookie' | 'bearer',
): Promise<ValidatedSession | null> {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashSessionToken(rawToken);

  const result = await query<{
    session_id: string;
    session_user_id: string;
    session_org_id: string;
    session_csrf_secret: string;
    session_expires_at: Date;
    session_created_at: Date;
    session_last_active_at: Date;
    u_id: string;
    u_org_id: string;
    u_email: string;
    u_first_name: string;
    u_last_name: string;
    u_role: 'Director' | 'Manager' | 'Admin';
    u_is_active: boolean;
    u_created_at: Date;
    u_updated_at: Date;
    org_id: string;
    org_name: string;
    org_slug: string;
    org_created_at: Date;
    org_updated_at: Date;
  }>(
    `SELECT
       s.id AS session_id,
       s.user_id AS session_user_id,
       s.organization_id AS session_org_id,
       s.csrf_secret AS session_csrf_secret,
       s.expires_at AS session_expires_at,
       s.created_at AS session_created_at,
       s.last_active_at AS session_last_active_at,
       u.id AS u_id,
       u.organization_id AS u_org_id,
       u.email AS u_email,
       u.first_name AS u_first_name,
       u.last_name AS u_last_name,
       u.role AS u_role,
       u.is_active AS u_is_active,
       u.created_at AS u_created_at,
       u.updated_at AS u_updated_at,
       o.id AS org_id,
       o.name AS org_name,
       o.slug AS org_slug,
       o.created_at AS org_created_at,
       o.updated_at AS org_updated_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     INNER JOIN organizations o ON o.id = s.organization_id
     WHERE s.session_token_hash = $1`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0]!;
  const now = new Date();

  // Check if session has expired
  if (new Date(row.session_expires_at) <= now) {
    logger.warn('Session has expired. Cleaning up expired session.', {
      sessionId: row.session_id,
      userId: row.session_user_id,
    });
    await query('DELETE FROM sessions WHERE id = $1', [row.session_id]);
    return null;
  }

  // Check if user is active
  if (!row.u_is_active) {
    logger.warn('User account is deactivated. Revoking session.', {
      userId: row.u_id,
    });
    await query('DELETE FROM sessions WHERE id = $1', [row.session_id]);
    return null;
  }

  // Asynchronously update last_active_at if more than 5 minutes have elapsed
  const lastActive = new Date(row.session_last_active_at).getTime();
  if (now.getTime() - lastActive > 5 * 60 * 1000) {
    void query('UPDATE sessions SET last_active_at = $1 WHERE id = $2', [
      now.toISOString(),
      row.session_id,
    ]);
  }

  const session: SessionRecord = {
    id: row.session_id,
    userId: row.session_user_id,
    organizationId: row.session_org_id,
    csrfSecret: row.session_csrf_secret,
    expiresAt: row.session_expires_at,
    createdAt: row.session_created_at,
    lastActiveAt: row.session_last_active_at,
  };

  const user: User = {
    id: row.u_id,
    organizationId: row.u_org_id,
    email: row.u_email,
    firstName: row.u_first_name,
    lastName: row.u_last_name,
    role: row.u_role,
    isActive: row.u_is_active,
    createdAt: row.u_created_at.toISOString(),
    updatedAt: row.u_updated_at.toISOString(),
  };

  const organization: Organization = {
    id: row.org_id,
    name: row.org_name,
    slug: row.org_slug,
    createdAt: row.org_created_at.toISOString(),
    updatedAt: row.org_updated_at.toISOString(),
  };

  return { session, user, organization, authMethod };
}

/**
 * Revokes a single session by its raw token
 */
export async function revokeSession(rawToken: string): Promise<boolean> {
  const tokenHash = hashSessionToken(rawToken);
  const result = await query('DELETE FROM sessions WHERE session_token_hash = $1', [tokenHash]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Revokes all sessions for a specific user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}
