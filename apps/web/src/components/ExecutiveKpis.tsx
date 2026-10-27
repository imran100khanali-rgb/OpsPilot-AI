'use client';

import React from 'react';
import { DashboardKpis } from '@opspilot/shared';

interface ExecutiveKpisProps {
  kpis: DashboardKpis | null;
  loading: boolean;
}

export const ExecutiveKpis: React.FC<ExecutiveKpisProps> = ({ kpis, loading }) => {
  if (loading) {
    return (
      <div className="kpi-grid" aria-label="Loading KPI Metrics" id="kpi-loading-skeletons">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card kpi-card">
            <div
              className="skeleton"
              style={{ height: '14px', width: '60%', marginBottom: '0.75rem' }}
            />
            <div
              className="skeleton"
              style={{ height: '36px', width: '40%', marginBottom: '0.5rem' }}
            />
            <div className="skeleton" style={{ height: '12px', width: '80%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div
        className="card"
        id="kpi-empty-state"
        style={{
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          borderRadius: '0.5rem',
        }}
      >
        <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📊</div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Operational Metrics Unavailable
        </div>
        <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
          KPI data is currently unavailable. Please authenticate with an authorized account or
          adjust filter parameters.
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-grid" aria-label="Executive KPI Metrics">
      {/* 1. Active Projects */}
      <div className="card kpi-card" id="kpi-active-projects">
        <div className="kpi-title">
          <span>Active Projects</span>
          <span style={{ fontSize: '1rem' }}>📁</span>
        </div>
        <div className="kpi-value">{kpis.activeProjects}</div>
        <div className="kpi-footer">
          <span className="badge badge-success">Live Workstreams</span>
          <span>of {kpis.totalProjects} total</span>
        </div>
      </div>

      {/* 2. Overdue Tasks */}
      <div
        className="card kpi-card"
        id="kpi-overdue-tasks"
        style={{
          borderLeft: kpis.overdueTasks > 0 ? '4px solid #ef4444' : undefined,
        }}
      >
        <div className="kpi-title">
          <span>Overdue Tasks</span>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
        </div>
        <div
          className="kpi-value"
          style={{ color: kpis.overdueTasks > 0 ? '#ef4444' : 'var(--text-primary)' }}
        >
          {kpis.overdueTasks}
        </div>
        <div className="kpi-footer">
          <span className={kpis.overdueTasks > 0 ? 'badge badge-danger' : 'badge badge-success'}>
            {kpis.overdueTasks > 0 ? 'Target SLA Breached' : 'All Tasks On-Track'}
          </span>
        </div>
      </div>

      {/* 3. Blocked Projects */}
      <div
        className="card kpi-card"
        id="kpi-blocked-projects"
        style={{
          borderLeft: kpis.blockedProjects > 0 ? '4px solid #f59e0b' : undefined,
        }}
      >
        <div className="kpi-title">
          <span>Blocked Projects</span>
          <span style={{ fontSize: '1rem' }}>🚫</span>
        </div>
        <div
          className="kpi-value"
          style={{ color: kpis.blockedProjects > 0 ? '#f59e0b' : 'var(--text-primary)' }}
        >
          {kpis.blockedProjects}
        </div>
        <div className="kpi-footer">
          <span
            className={kpis.blockedProjects > 0 ? 'badge badge-warning' : 'badge badge-success'}
          >
            {kpis.blockedProjects > 0 ? 'Impediments Identified' : 'Zero Blockers'}
          </span>
        </div>
      </div>

      {/* 4. Pending Approvals */}
      <div className="card kpi-card" id="kpi-pending-approvals">
        <div className="kpi-title">
          <span>Pending Approvals</span>
          <span style={{ fontSize: '1rem' }}>⏳</span>
        </div>
        <div className="kpi-value">{kpis.pendingApprovals}</div>
        <div className="kpi-footer">
          <span className="badge badge-info">Director / Admin Signoff</span>
        </div>
      </div>

      {/* 5. Collection Follow-ups */}
      <div className="card kpi-card" id="kpi-collection-followups">
        <div className="kpi-title">
          <span>Collection Follow-ups</span>
          <span style={{ fontSize: '1rem' }}>💰</span>
        </div>
        <div className="kpi-value">{kpis.collectionFollowUps}</div>
        <div className="kpi-footer">
          <span
            className={kpis.collectionFollowUps > 0 ? 'badge badge-warning' : 'badge badge-success'}
          >
            {kpis.collectionFollowUps > 0 ? 'Actionable Invoices' : 'Collections Current'}
          </span>
        </div>
      </div>
    </div>
  );
};
