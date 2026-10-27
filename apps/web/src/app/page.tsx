'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { ExecutiveKpis } from '../components/ExecutiveKpis';
import { RiskIntelligenceFeed } from '../components/RiskIntelligenceFeed';
import { TrendChart } from '../components/TrendChart';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { fetchDashboardSummary, fetchDashboardTrends } from '../lib/api-client';
import { DashboardSummaryResponse, TrendDataPoint } from '@opspilot/shared';

export default function ExecutiveDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');

  const loadDashboard = useCallback(async () => {
    setLoadingSummary(true);
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
                Executive Operations Intelligence
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Unified executive visibility across project health, risk velocity, and accounts
                receivable follow-ups.
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
          OpsPilot AI Executive Platform • Multi-Tenant Organization Isolation • Zero Hardcoded
          Values
        </div>
      </footer>
    </div>
  );
}
