'use client';

import React from 'react';
import { TrendDataPoint } from '@opspilot/shared';

interface TrendChartProps {
  trends: TrendDataPoint[];
  loading: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ trends, loading }) => {
  if (loading) {
    return (
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="skeleton" style={{ height: '20px', width: '35%', marginBottom: '1rem' }} />
        <div className="skeleton" style={{ height: '160px', width: '100%' }} />
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Operations Velocity & Trend Analysis
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Insufficient telemetry data points to generate trajectory.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...trends.flatMap((t) => [t.createdTasks, t.completedTasks, t.overdueTasks, t.activeProjects]),
  );

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            14-Day Operations Velocity & Risk Trajectory
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Comparing created workstreams, task completions, and active project baselines
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#6366f1',
                borderRadius: '2px',
              }}
            />
            <span>Created Tasks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#10b981',
                borderRadius: '2px',
              }}
            />
            <span>Completed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#ef4444',
                borderRadius: '2px',
              }}
            />
            <span>Overdue</span>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart Visualization */}
      <div
        style={{
          width: '100%',
          height: '180px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          paddingTop: '10px',
        }}
      >
        {trends.map((point) => {
          const createdH = Math.max(4, Math.round((point.createdTasks / maxVal) * 140));
          const completedH = Math.max(4, Math.round((point.completedTasks / maxVal) * 140));
          const overdueH = Math.max(4, Math.round((point.overdueTasks / maxVal) * 140));
          const shortDate = point.date.slice(5);

          return (
            <div
              key={point.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
              title={`Date: ${point.date}\nCreated: ${point.createdTasks}\nCompleted: ${point.completedTasks}\nOverdue: ${point.overdueTasks}`}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '30%',
                    maxWidth: '12px',
                    height: `${createdH}px`,
                    backgroundColor: '#6366f1',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                <div
                  style={{
                    width: '30%',
                    maxWidth: '12px',
                    height: `${completedH}px`,
                    backgroundColor: '#10b981',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                <div
                  style={{
                    width: '30%',
                    maxWidth: '12px',
                    height: `${overdueH}px`,
                    backgroundColor: '#ef4444',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortDate}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
