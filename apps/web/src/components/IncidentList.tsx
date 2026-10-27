import React from 'react';
import { Incident } from '@opspilot/shared';

interface IncidentListProps {
  incidents: Incident[];
}

export const IncidentList: React.FC<IncidentListProps> = ({ incidents }) => {
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
            AI Operations Incident Diagnostics
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Autonomous root cause analysis and anomalous pattern identification
          </p>
        </div>
        <span className="ai-pill">OpsPilot AI Triage</span>
      </div>

      {incidents.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'rgba(16, 185, 129, 0.04)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed rgba(16, 185, 129, 0.2)',
          }}
        >
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.9rem' }}>
            ✓ No Unresolved Incidents Detected
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            All systems nominal. Automated surveillance running continuous checks.
          </p>
        </div>
      ) : (
        incidents.map((inc) => (
          <div
            key={inc.id}
            className={`incident-card ${
              inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'high' : ''
            }`}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#fff',
                    marginRight: '0.5rem',
                  }}
                >
                  {inc.title}
                </span>
                <span
                  className={`badge ${
                    inc.severity === 'critical'
                      ? 'badge-critical'
                      : inc.severity === 'high'
                        ? 'badge-high'
                        : 'badge-medium'
                  }`}
                >
                  {inc.severity}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Detected {new Date(inc.detectedAt).toLocaleTimeString()}
              </span>
            </div>

            {inc.aiSummary && (
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.08)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  marginTop: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#d8b4fe',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span>✦ AI DIAGNOSTIC SYNTHESIS:</span>
                </div>
                {inc.aiSummary}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
