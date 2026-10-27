import React from 'react';

interface HeaderProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'connecting';
  environment?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  environment = 'production',
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="header-nav">
      <div className="container header-content">
        <div className="logo-group">
          <div className="logo-icon">OP</div>
          <div>
            <div className="logo-text">OpsPilot AI</div>
            <div className="logo-subtext">Enterprise Operations Intelligence</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className={`pulse-dot ${
                status === 'healthy' ? 'healthy' : status === 'degraded' ? 'degraded' : 'unhealthy'
              }`}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
              {status === 'healthy'
                ? 'Systems Operational'
                : status === 'degraded'
                  ? 'System Degraded'
                  : status === 'connecting'
                    ? 'Connecting to Node...'
                    : 'System Alert'}
            </span>
            <span className="badge badge-production">{environment}</span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {isRefreshing ? 'Refreshing...' : '↻ Refresh Telemetry'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
