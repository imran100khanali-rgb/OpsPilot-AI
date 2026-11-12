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
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Top Delivery Risks &amp; Impediments
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Live delivery risk radar evaluating milestone SLAs, project blockers, and stalled
            approvals
          </p>
        </div>
        <span
          className="badge badge-info"
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', fontWeight: 600 }}
        >
          {risks.length} Actionable Risks Detected
        </span>
      </div>

      {risks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛡️</div>
          <div className="empty-title">Zero Delivery Risks Identified</div>
          <p className="empty-desc">
            All Salesforce &amp; Cloud workstreams are on schedule, zero critical blockers, and
            approvals are flowing smoothly.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {risks.map((risk) => {
            const streamName =
              risk.sourceRecord.projectName ||
              (risk.sourceRecord.type === 'project'
                ? risk.sourceRecord.name
                : 'General Operations');
            const ownerName = risk.sourceRecord.ownerName || 'Unassigned';
            const dueDateDisplay = risk.sourceRecord.dueDate
              ? new Date(risk.sourceRecord.dueDate).toLocaleDateString()
              : 'No target SLA date configured';
            const projectDrillDownId =
              risk.sourceRecord.projectId ||
              (risk.sourceRecord.type === 'project' ? risk.sourceRecord.id : null);

            return (
              <div
                key={risk.id}
                className={`risk-item ${risk.severity}`}
                id={`risk-${risk.id}`}
                style={{ padding: '1.1rem 1.25rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.6rem',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className={`badge ${
                        risk.severity === 'critical'
                          ? 'badge-danger'
                          : risk.severity === 'high'
                            ? 'badge-warning'
                            : 'badge-info'
                      }`}
                      style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '0.72rem' }}
                    >
                      {risk.severity}
                    </span>
                    <span
                      style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}
                    >
                      {risk.title}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {projectDrillDownId && (
                      <Link
                        href={`/projects/${projectDrillDownId}`}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Inspect Stream →
                      </Link>
                    )}
                    {risk.sourceRecord.type === 'task' && (
                      <Link
                        href="/tasks"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        View Task
                      </Link>
                    )}
                  </div>
                </div>

                {/* Metadata Attribution Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.65rem',
                    flexWrap: 'wrap',
                    fontSize: '0.78rem',
                  }}
                >
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    📁 Stream: {streamName}
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      color:
                        ownerName === 'Unassigned' ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  >
                    👤 Owner: <strong>{ownerName}</strong>
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    📅 Target Due: {dueDateDisplay}
                  </span>
                </div>

                {/* Deterministic Explanation */}
                <p
                  style={{
                    fontSize: '0.86rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.65rem',
                    lineHeight: 1.5,
                  }}
                >
                  {risk.explanation}
                </p>

                {/* Actionable Remediation Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    backgroundColor: 'var(--accent-primary-subtle)',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    width: 'fit-content',
                  }}
                >
                  <span>✦ RECOMMENDED NEXT STEP:</span>
                  <span>{risk.suggestedAction}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
