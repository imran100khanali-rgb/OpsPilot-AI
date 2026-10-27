import React from 'react';
import { System } from '@opspilot/shared';

interface SystemsGridProps {
  systems: System[];
  loading: boolean;
}

export const SystemsGrid: React.FC<SystemsGridProps> = ({ systems, loading }) => {
  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            Monitored Enterprise Systems
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            PostgreSQL-backed active service catalog and observability targets
          </p>
        </div>
        <span className="badge badge-production">{systems.length} Registered</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>System Service</th>
              <th>Slug / Identifier</th>
              <th>Environment</th>
              <th>Operational Status</th>
              <th>Discovery Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && systems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading enterprise services catalog...
                </td>
              </tr>
            ) : systems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No systems found. Apply database migrations to seed default enterprise systems.
                </td>
              </tr>
            ) : (
              systems.map((sys) => (
                <tr key={sys.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{sys.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {sys.description || 'Core operations node'}
                    </div>
                  </td>
                  <td>
                    <code
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: 'var(--accent-blue)',
                      }}
                    >
                      {sys.slug}
                    </code>
                  </td>
                  <td>
                    <span className="badge badge-production">{sys.environment}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        sys.status === 'operational'
                          ? 'badge-operational'
                          : sys.status === 'degraded'
                            ? 'badge-degraded'
                            : 'badge-outage'
                      }`}
                    >
                      {sys.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(sys.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
