'use client';

import React from 'react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  status: string;
  statusOptions?: { label: string; value: string }[];
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onStatusChange: (val: string) => void;
  onReset: () => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  status,
  statusOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Blocked', value: 'blocked' },
    { label: 'Completed', value: 'completed' },
    { label: 'Paused', value: 'paused' },
  ],
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
  onReset,
}) => {
  const setPreset = (days: number) => {
    const end = new Date().toISOString().split('T')[0]!;
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]!;
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <div
      className="card"
      style={{
        padding: '0.85rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Quick Filter:
        </span>
        <button
          onClick={() => {
            onStartDateChange('');
            onEndDateChange('');
          }}
          className={`btn btn-secondary btn-sm ${!startDate && !endDate ? 'active' : ''}`}
        >
          All Time
        </button>
        <button onClick={() => setPreset(7)} className="btn btn-secondary btn-sm">
          Last 7 Days
        </button>
        <button onClick={() => setPreset(30)} className="btn btn-secondary btn-sm">
          Last 30 Days
        </button>
        <button onClick={() => setPreset(90)} className="btn btn-secondary btn-sm">
          This Quarter
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Start Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <label
            htmlFor="filter-start-date"
            style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
          >
            From:
          </label>
          <input
            id="filter-start-date"
            type="date"
            className="form-control"
            style={{ width: '135px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        {/* End Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <label
            htmlFor="filter-end-date"
            style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
          >
            To:
          </label>
          <input
            id="filter-end-date"
            type="date"
            className="form-control"
            style={{ width: '135px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <label
            htmlFor="filter-status-select"
            style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
          >
            Status:
          </label>
          <select
            id="filter-status-select"
            className="form-control"
            style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {(startDate || endDate || (status && status !== 'all')) && (
          <button onClick={onReset} className="btn btn-secondary btn-sm" title="Clear Filters">
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
};
