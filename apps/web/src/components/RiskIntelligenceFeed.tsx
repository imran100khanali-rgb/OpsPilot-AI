'use client';

import React from 'react';
import Link from 'next/link';
import { RiskItem } from '@opspilot/shared';

interface RiskIntelligenceFeedProps {
  risks: RiskItem[];
  loading: boolean;
}

export const RiskIntelligenceFeed: React.FC<RiskIntelligenceFeedProps> = ({ risks, loading }) => {
  if (loading) {
    return (
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="skeleton" style={{ height: '20px', width: '30%', marginBottom: '1rem' }} />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: '70px', width: '100%', marginBottom: '0.75rem' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.85rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Deterministic Risk Intelligence Feed
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Rule-based evaluations for overdue milestones, project blockers, and stalled approvals
          </p>
        </div>
        <span
          className="badge badge-info"
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
        >
          {risks.length} Detected Risks
        </span>
      </div>

      {risks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛡️</div>
          <div className="empty-title">Zero Operational Risks Identified</div>
          <p className="empty-desc">
            All tasks are within deadline SLAs, no projects are blocked, and approvals are flowing
            smoothly.
          </p>
        </div>
      ) : (
        <div>
          {risks.map((risk) => (
            <div key={risk.id} className={`risk-item ${risk.severity}`} id={`risk-${risk.id}`}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.4rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className={`badge ${
                      risk.severity === 'critical'
                        ? 'badge-danger'
                        : risk.severity === 'high'
                          ? 'badge-warning'
                          : 'badge-info'
                    }`}
                  >
                    {risk.severity}
                  </span>
                  <span
                    style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}
                  >
                    {risk.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    Source: {risk.sourceRecord.type.toUpperCase()} • ID:{' '}
                    {risk.sourceRecord.id.slice(0, 8)}...
                  </span>
                  {risk.sourceRecord.type === 'project' && (
                    <Link href="/projects" className="btn btn-secondary btn-sm">
                      View Project
                    </Link>
                  )}
                  {risk.sourceRecord.type === 'task' && (
                    <Link href="/tasks" className="btn btn-secondary btn-sm">
                      View Task
                    </Link>
                  )}
                </div>
              </div>

              {/* Deterministic Explanation */}
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  lineHeight: 1.45,
                }}
              >
                {risk.explanation}
              </p>

              {/* Actionable Recommendation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary-subtle)',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  width: 'fit-content',
                }}
              >
                <span>✦ RECOMMENDED REMEDIATION:</span>
                <span>{risk.suggestedAction}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
