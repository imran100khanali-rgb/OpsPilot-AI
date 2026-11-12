'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { RiskIntelligenceFeed } from '../components/RiskIntelligenceFeed';
import { TrendChart } from '../components/TrendChart';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { fetchDashboardSummary, fetchDashboardTrends, fetchProjects } from '../lib/api-client';
import { DashboardSummaryResponse, TrendDataPoint, Project } from '@opspilot/shared';

export default function ExecutiveDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');

  const loadDashboard = useCallback(async () => {
    setLoadingSummary(true);
    setLoadingProjects(true);
    setErrorMessage(null);

    const summaryRes = await fetchDashboardSummary({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: status !== 'all' ? status : undefined,
    });

    if (summaryRes.error) {
      setErrorMessage(summaryRes.error);
    } else if (summaryRes.data) {
      setSummary(summaryRes.data);
    }
    setLoadingSummary(false);

    const projectsRes = await fetchProjects({
      status: status !== 'all' ? status : undefined,
      limit: 20,
    });
    if (projectsRes.data?.items) {
      setProjects(projectsRes.data.items);
    }
    setLoadingProjects(false);
  }, [startDate, endDate, status]);

  const loadTrends = useCallback(async () => {
    setLoadingTrends(true);
    const trendsRes = await fetchDashboardTrends();
    if (trendsRes.data) {
      setTrends(trendsRes.data.trends);
    }
    setLoadingTrends(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadTrends();
  }, [loadTrends]);

  useEffect(() => {
    const handleAuthChange = () => {
      void loadDashboard();
      void loadTrends();
    };
    window.addEventListener('opspilot:auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('opspilot:auth-change', handleAuthChange);
    };
  }, [loadDashboard, loadTrends]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatus('all');
  };

  const isAuthRequired = Boolean(
    errorMessage &&
    (errorMessage.toLowerCase().includes('authentication required') ||
      errorMessage.toLowerCase().includes('log in') ||
      errorMessage.includes('401')),
  );

  const handleOpenLogin = () => {
    window.dispatchEvent(new CustomEvent('opspilot:open-login'));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onLoginSuccess={() => {
          void loadDashboard();
          void loadTrends();
        }}
        onLogout={() => {
          setSummary(null);
          setTrends([]);
          setErrorMessage('Authentication required. Please log in.');
        }}
      />

      <main style={{ flex: 1, padding: '1.75rem 0 3rem' }}>
        <div className="container">
          {/* Header & Subtitle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                iBirds AI Delivery Intelligence
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Salesforce &amp; Cloud Delivery Command Center — Executive risk radar, deliverable
                SLA health, and root-cause intelligence.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <Link href="/projects" className="btn btn-secondary">
                📁 Projects Workspace
              </Link>
              <Link href="/tasks" className="btn btn-primary">
                📋 Tasks & Operations
              </Link>
            </div>
          </div>

          {/* Authentication Required Action Banner */}
          {isAuthRequired && (
            <div
              className="card"
              id="auth-required-banner"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🔐</span>
                <div>
                  <div
                    style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}
                  >
                    Authentication Required
                  </div>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.15rem',
                    }}
                  >
                    Sign in to your organization account to unlock real-time KPI metrics, operations
                    velocity curves, and risk alerts.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={handleOpenLogin}
                  className="btn btn-primary"
                  id="open-login-btn"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Sign In to OpsPilot
                </button>
                <button
                  onClick={() => void loadDashboard()}
                  className="btn btn-secondary"
                  id="auth-retry-btn"
                  style={{ padding: '0.5rem 0.85rem' }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Standard Error Banner (Non-Auth Errors) */}
          {!isAuthRequired && errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                color: 'var(--status-danger-text)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              role="alert"
            >
              <span>{errorMessage}</span>
              <button
                onClick={() => void loadDashboard()}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Unified Date Range & Status Filters */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            status={status}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onStatusChange={setStatus}
            onReset={handleResetFilters}
          />

          {/* Real PostgreSQL-backed KPI Cards */}
          <ExecutiveKpis kpis={summary?.kpis || null} loading={loadingSummary} />

          {/* Project Health Matrix */}
          <div
            className="card"
            style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
            id="project-health-matrix-section"
          >
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
                  Project Health Matrix
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Executive delivery health across Salesforce &amp; Cloud accounts, practice areas,
                  and primary delivery risks
                </p>
              </div>
              <span
                className="badge badge-info"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', fontWeight: 600 }}
              >
                {projects.length} Active Streams
              </span>
            </div>

            {loadingProjects ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: '48px', width: '100%' }} />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <div className="empty-title">No Delivery Streams Found</div>
                <p className="empty-desc">
                  No project workstreams match the current filters. Please adjust status or date
                  range.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '2px solid var(--border-color)',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontSize: '0.76rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '0.75rem 0.65rem' }}>Project / Client</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Practice Area</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Health Status</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Delivery Lead</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Overdue Deliverables</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Target Go-Live / Due</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Primary Risk</th>
                      <th style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((proj) => {
                      const health = proj.healthStatus || 'green';
                      const practiceArea = getPracticeArea(proj);
                      const overdueCount = proj.overdueDeliverables || 0;
                      const targetDate = proj.targetGoLive
                        ? new Date(proj.targetGoLive).toLocaleDateString()
                        : 'No target SLA set';
                      const lead = proj.deliveryLead || 'Unassigned Lead';
                      const riskText =
                        proj.primaryRisk ||
                        (health === 'red'
                          ? 'Critical delivery blocker'
                          : health === 'amber'
                            ? 'Milestone delay risk'
                            : 'On track');

                      const healthBadgeClass =
                        health === 'red'
                          ? 'badge-danger'
                          : health === 'amber'
                            ? 'badge-warning'
                            : 'badge-success';

                      return (
                        <tr
                          key={proj.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <Link
                              href={`/projects/${proj.id}`}
                              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                            >
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {proj.name}
                              </div>
                              {proj.description && (
                                <div
                                  style={{
                                    fontSize: '0.76rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  {proj.description.slice(0, 75)}...
                                </div>
                              )}
                            </Link>
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-subtle)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                              }}
                            >
                              {practiceArea}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <span
                              className={`badge ${healthBadgeClass}`}
                              style={{
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: '0.72rem',
                              }}
                            >
                              {health === 'red'
                                ? '🔴 RED'
                                : health === 'amber'
                                  ? '🟡 AMBER'
                                  : '🟢 GREEN'}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '0.85rem 0.65rem',
                              color:
                                lead === 'Unassigned Lead'
                                  ? 'var(--text-muted)'
                                  : 'var(--text-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {lead}
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            {overdueCount > 0 ? (
                              <span className="badge badge-danger">{overdueCount} overdue</span>
                            ) : (
                              <span className="badge badge-success">0 overdue</span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '0.85rem 0.65rem',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {targetDate}
                          </td>
                          <td
                            style={{
                              padding: '0.85rem 0.65rem',
                              fontSize: '0.8rem',
                              color:
                                health === 'red'
                                  ? '#ef4444'
                                  : health === 'amber'
                                    ? '#f59e0b'
                                    : 'var(--text-secondary)',
                            }}
                          >
                            {riskText}
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem', textAlign: 'right' }}>
                            <Link
                              href={`/projects/${proj.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              Drill Down →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operations Trends Chart */}
          <TrendChart trends={trends} loading={loadingTrends} />

          {/* Risk Intelligence Feed */}
          <RiskIntelligenceFeed risks={summary?.risks || []} loading={loadingSummary} />

          {/* Distribution & Status Breakdown */}
          {summary?.statusBreakdown && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Project Statuses */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h4
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Projects by Status
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.82rem',
                  }}
                >
                  {Object.entries(summary.statusBreakdown.projects).map(([st, cnt]) => (
                    <div
                      key={st}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {st}
                      </span>
                      <span className="badge badge-info">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Priorities */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h4
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Tasks by Priority
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.82rem',
                  }}
                >
                  {Object.entries(summary.statusBreakdown.tasksByPriority).map(([pri, cnt]) => (
                    <div
                      key={pri}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {pri}
                      </span>
                      <span
                        className={`badge ${
                          pri === 'urgent'
                            ? 'badge-danger'
                            : pri === 'high'
                              ? 'badge-warning'
                              : 'badge-info'
                        }`}
                      >
                        {cnt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Completion SLA */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h4
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Operations Velocity SLA
                </h4>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      marginBottom: '0.3rem',
                    }}
                  >
                    <span>Completion Rate</span>
                    <span style={{ fontWeight: 700 }}>{summary.kpis.taskCompletionRate}%</span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${summary.kpis.taskCompletionRate}%`,
                        height: '100%',
                        backgroundColor: '#10b981',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {summary.kpis.completedTasks} completed out of {summary.kpis.totalTasks} total
                  tasks logged across active initiatives.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '1.25rem 0',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="container">
          iBirds AI Delivery Intelligence • Salesforce &amp; Cloud Delivery Command Center •
          Multi-Tenant Isolation • Zero Hardcoded Values
        </div>
      </footer>
    </div>
  );
}

function getPracticeArea(project: Project): string {
  if (project.practiceArea) return project.practiceArea;
  const text = `${project.name} ${project.description || ''}`.toLowerCase();
  if (text.includes('health') || text.includes('patient') || text.includes('ehr'))
    return 'Salesforce Health Cloud';
  if (text.includes('cpq') || text.includes('billing') || text.includes('quote'))
    return 'Salesforce CPQ & Billing';
  if (text.includes('service') || text.includes('omni') || text.includes('call center'))
    return 'Service Cloud & Omni-Channel';
  if (text.includes('financial') || text.includes('fsc') || text.includes('wealth'))
    return 'Financial Services Cloud';
  if (
    text.includes('kubernetes') ||
    text.includes('observability') ||
    text.includes('telemetry') ||
    text.includes('cluster')
  )
    return 'Cloud Architecture & DevOps';
  return 'Salesforce Enterprise Core';
}
