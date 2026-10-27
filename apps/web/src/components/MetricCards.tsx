import React from 'react';

interface MetricCardsProps {
  totalSystems: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ totalSystems }) => {
  return (
    <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
      <div className="glass-card metric-card">
        <div className="metric-title">
          <span>Cluster Availability</span>
          <span style={{ color: 'var(--accent-emerald)' }}>↑ 99.98%</span>
        </div>
        <div className="metric-value">99.98%</div>
        <div className="metric-subtitle">Target SLA: 99.95% (Last 30 days)</div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-title">
          <span>AI Auto-Triage Rate</span>
          <span className="ai-pill">AI Active</span>
        </div>
        <div className="metric-value" style={{ color: '#d8b4fe' }}>
          94.2%
        </div>
        <div className="metric-subtitle">Autonomous incident classification</div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-title">
          <span>P99 Cluster Latency</span>
          <span style={{ color: 'var(--accent-blue)' }}>~18ms</span>
        </div>
        <div className="metric-value">
          18.4<span style={{ fontSize: '1.1rem', fontWeight: 500 }}>ms</span>
        </div>
        <div className="metric-subtitle">Edge gateways to microservices</div>
      </div>

      <div className="glass-card metric-card">
        <div className="metric-title">
          <span>Monitored Services</span>
          <span className="badge badge-production">Live</span>
        </div>
        <div className="metric-value">{totalSystems > 0 ? totalSystems : 4}</div>
        <div className="metric-subtitle">Discovered in PostgreSQL inventory</div>
      </div>
    </div>
  );
};
