import React from 'react';
import { HealthCheckResult } from '@opspilot/shared';

interface HealthStatusWidgetProps {
  health: HealthCheckResult | null;
  loading: boolean;
  error?: string | null;
}

export const HealthStatusWidget: React.FC<HealthStatusWidgetProps> = ({
  health,
  loading,
  error,
}) => {
  if (loading && !health) {
    return (
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Polling health telemetry from API...</p>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          borderLeft: '4px solid var(--accent-rose)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.25rem' }}>
              API Health Telemetry Unavailable
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--accent-rose)' }}>
              {error || 'Unable to establish HTTP connection to http://localhost:4000/api/health'}
            </p>
          </div>
          <span className="badge badge-critical">Offline</span>
        </div>
      </div>
    );
  }

  const { status, uptimeSeconds, components, environment, version } = health;
  const dbHealth = components.database;
  const memory = components.memory;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            Infrastructure Health & Diagnostics
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Live verification of API process, database pool, and memory allocation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            className={`badge ${status === 'healthy' ? 'badge-operational' : 'badge-degraded'}`}
          >
            {status}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v{version}</span>
        </div>
      </div>

      <div className="grid-4">
        {/* PostgreSQL Pool */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
          >
            PostgreSQL Pool
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              className={`pulse-dot ${dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy'}`}
            />
            <span style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
              {dbHealth.status === 'healthy' ? 'Connected' : 'Unavailable'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Latency: {dbHealth.latencyMs ? `${dbHealth.latencyMs}ms` : 'N/A'}
          </div>
        </div>

        {/* API Uptime */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
          >
            Process Uptime
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
            {formatUptime(uptimeSeconds)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Environment: {environment}
          </div>
        </div>

        {/* Memory RSS */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
          >
            Memory Allocation
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
            {memory ? `${memory.rssMB} MB` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Heap Used: {memory ? `${memory.heapUsedMB} MB` : 'N/A'}
          </div>
        </div>

        {/* Request Tracing */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
          >
            Observability Pipeline
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#38bdf8' }}>Enabled</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            X-Request-ID & Safe Redaction
          </div>
        </div>
      </div>
    </div>
  );
};
