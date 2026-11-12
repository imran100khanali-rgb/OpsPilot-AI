'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Navbar } from '../../../components/Navbar';
import { fetchProject, fetchTasks, fetchApprovals } from '../../../lib/api-client';
import { Project, Task, Approval } from '@opspilot/shared';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const [projRes, tasksRes, appRes] = await Promise.all([
      fetchProject(projectId),
      fetchTasks({ projectId, limit: 100 }),
      fetchApprovals(),
    ]);

    if (projRes.error) {
      setErrorMessage(projRes.error);
    } else if (projRes.data) {
      setProject(projRes.data);
    }

    if (tasksRes.data?.items) {
      setTasks(tasksRes.data.items);
    }

    if (appRes.data && tasksRes.data?.items) {
      const taskIds = new Set(tasksRes.data.items.map((t) => t.id));
      const projectApprovals = appRes.data.filter((a) => a.taskId && taskIds.has(a.taskId));
      setApprovals(projectApprovals);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, padding: '2rem 0' }}>
          <div className="container">
            <div
              className="skeleton"
              style={{ height: '32px', width: '40%', marginBottom: '1.5rem' }}
            />
            <div
              className="skeleton"
              style={{ height: '140px', width: '100%', marginBottom: '1.5rem' }}
            />
            <div className="skeleton" style={{ height: '220px', width: '100%' }} />
          </div>
        </main>
      </div>
    );
  }

  if (errorMessage || !project) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, padding: '2rem 0' }}>
          <div className="container">
            <div
              className="card"
              style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                color: 'var(--status-danger-text)',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Delivery Stream Not Accessible
              </h2>
              <p style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                {errorMessage || 'Project record could not be found or belongs to another tenant.'}
              </p>
              <Link href="/" className="btn btn-primary">
                ← Return to Executive Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Segment tasks
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date(),
  );
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const reviewTasks = tasks.filter((t) => t.status === 'review');
  const todoTasks = tasks.filter((t) => t.status === 'todo');

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const agingApprovals = pendingApprovals.filter((a) => {
    const hours = (Date.now() - new Date(a.createdAt).getTime()) / 3600000;
    return hours >= 48;
  });

  const health = project.healthStatus || 'green';
  const practiceArea = inferPracticeArea(project);
  const deliveryLead = project.deliveryLead || 'Unassigned Lead';
  const targetGoLive = project.targetGoLive
    ? new Date(project.targetGoLive).toLocaleDateString()
    : 'No target SLA date configured';

  // Deterministic health reason
  let healthExplanation =
    'All project deliverables are tracking on schedule with zero active impediments or aging approvals.';
  if (health === 'red') {
    if (project.status === 'blocked') {
      healthExplanation =
        'Project operational status is flagged as BLOCKED. Initiative delivery is halted pending executive intervention.';
    } else if (blockedTasks.some((t) => t.priority === 'urgent')) {
      const urgent = blockedTasks.find((t) => t.priority === 'urgent');
      healthExplanation = `Urgent delivery blocker detected on task '${urgent?.title}'. Release milestone is currently halted.`;
    } else {
      healthExplanation = `Contains deliverable(s) overdue past the 7-day critical SLA threshold (${overdueTasks.length} overdue task(s) logged).`;
    }
  } else if (health === 'amber') {
    if (agingApprovals.length > 0) {
      healthExplanation = `Release gate delayed: Contains ${agingApprovals.length} pending approval request(s) exceeding the 48-hour SLA threshold.`;
    } else if (overdueTasks.length > 0) {
      healthExplanation = `Milestone delay: ${overdueTasks.length} deliverable(s) are overdue past scheduled target due date.`;
    } else {
      healthExplanation = `Dependency impediment: ${blockedTasks.length} task(s) currently marked as blocked awaiting external prerequisites.`;
    }
  }

  // Evidence-based recommended next steps
  const recommendedSteps: string[] = [];
  if (blockedTasks.length > 0) {
    const urgentBlocker = blockedTasks.find((t) => t.priority === 'urgent');
    if (urgentBlocker) {
      const owner = urgentBlocker.assignedUserName || 'team lead';
      recommendedSteps.push(
        `Immediately triage urgent blocker '${urgentBlocker.title}' with ${owner} and cloud architect.`,
      );
    } else {
      recommendedSteps.push(
        `Review ${blockedTasks.length} blocked task(s) in daily standup to resolve dependency prerequisites.`,
      );
    }
  }
  if (agingApprovals.length > 0) {
    recommendedSteps.push(
      `Director/Executive sign-off required for ${agingApprovals.length} aging approval(s) (>48h SLA breached) to unblock deployment gates.`,
    );
  }
  if (overdueTasks.length > 0) {
    const worst = overdueTasks[0]!;
    recommendedSteps.push(
      `Reallocate sprint capacity or adjust delivery target for overdue deliverable '${worst.title}'.`,
    );
  }
  if (recommendedSteps.length === 0) {
    recommendedSteps.push(
      'Maintain current sprint cadence; all deliverables and release gates are operating within SLA.',
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '1.75rem 0 3rem' }}>
        <div className="container">
          {/* Breadcrumb Navigation */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
            }}
          >
            <Link href="/" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
              Delivery Command Center
            </Link>
            <span>/</span>
            <Link
              href="/projects"
              style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
            >
              Workspaces
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{project.name}</span>
          </nav>

          {/* Executive Stream Header Card */}
          <div
            className="card"
            style={{
              padding: '1.75rem',
              marginBottom: '1.5rem',
              borderLeft:
                health === 'red'
                  ? '6px solid #ef4444'
                  : health === 'amber'
                    ? '6px solid #f59e0b'
                    : '6px solid #10b981',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    marginBottom: '0.4rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className={
                      health === 'red'
                        ? 'badge badge-danger'
                        : health === 'amber'
                          ? 'badge badge-warning'
                          : 'badge badge-success'
                    }
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.3rem 0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {health === 'red'
                      ? '🔴 CRITICAL DELIVERY RISK'
                      : health === 'amber'
                        ? '🟡 MILESTONE DELAY RISK'
                        : '🟢 DELIVERY ON TRACK'}
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {practiceArea}
                  </span>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    Status: {project.status}
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    margin: '0.35rem 0',
                  }}
                >
                  {project.name}
                </h1>
                {project.description && (
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      maxWidth: '850px',
                      margin: 0,
                    }}
                  >
                    {project.description}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Link href="/copilot" className="btn btn-secondary">
                  ✨ Ask Copilot About Stream
                </Link>
                <Link href="/tasks" className="btn btn-primary">
                  📋 Manage All Tasks
                </Link>
              </div>
            </div>

            {/* Health Status & Root Cause Explanation */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '0.3rem',
                }}
              >
                Root Cause Health Explanation
              </div>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {healthExplanation}
              </p>
            </div>

            {/* Stream Attributes Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                fontSize: '0.82rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Delivery Lead: </span>
                <strong
                  style={{
                    color:
                      deliveryLead === 'Unassigned Lead'
                        ? 'var(--text-muted)'
                        : 'var(--text-primary)',
                  }}
                >
                  {deliveryLead}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Go-Live / SLA: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{targetGoLive}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Primary Impediment: </span>
                <strong
                  style={{
                    color:
                      health === 'red'
                        ? '#ef4444'
                        : health === 'amber'
                          ? '#f59e0b'
                          : 'var(--text-secondary)',
                  }}
                >
                  {project.primaryRisk || (health === 'red' ? 'Urgent delivery blocker' : 'None')}
                </strong>
              </div>
            </div>
          </div>

          {/* Stream Metric Indicators Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="card" style={{ padding: '1.15rem' }}>
              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Total Deliverables
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '0.25rem 0',
                }}
              >
                {tasks.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {completedTasks.length} completed (
                {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%)
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: '1.15rem',
                borderLeft: overdueTasks.length > 0 ? '4px solid #ef4444' : undefined,
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Overdue Past SLA
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: overdueTasks.length > 0 ? '#ef4444' : 'var(--text-primary)',
                  margin: '0.25rem 0',
                }}
              >
                {overdueTasks.length}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: overdueTasks.length > 0 ? '#ef4444' : 'var(--text-muted)',
                }}
              >
                {overdueTasks.length > 0
                  ? 'Milestone delivery breached'
                  : 'All deliverables on-track'}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: '1.15rem',
                borderLeft: blockedTasks.length > 0 ? '4px solid #f59e0b' : undefined,
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Blocked Deliverables
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: blockedTasks.length > 0 ? '#f59e0b' : 'var(--text-primary)',
                  margin: '0.25rem 0',
                }}
              >
                {blockedTasks.length}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: blockedTasks.length > 0 ? '#f59e0b' : 'var(--text-muted)',
                }}
              >
                {blockedTasks.length > 0 ? 'Execution halted on tasks' : 'Zero blockers identified'}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: '1.15rem',
                borderLeft: agingApprovals.length > 0 ? '4px solid #ef4444' : undefined,
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Aging Approvals (&gt;48h)
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: agingApprovals.length > 0 ? '#ef4444' : 'var(--text-primary)',
                  margin: '0.25rem 0',
                }}
              >
                {agingApprovals.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {pendingApprovals.length} total pending sign-offs
              </div>
            </div>
          </div>

          {/* Evidence-Based Recommended Next Steps Banner */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              marginBottom: '1.5rem',
              backgroundColor: 'rgba(2, 132, 199, 0.04)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
            }}
          >
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>✦</span> Recommended Next Steps Based on Real Evidence
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recommendedSteps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Delivery Blockers & Aging Approvals Side-by-Side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Delivery Blockers Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.75rem',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Delivery Blockers ({blockedTasks.length})
                </h3>
                <span
                  className={
                    blockedTasks.length > 0 ? 'badge badge-warning' : 'badge badge-success'
                  }
                >
                  {blockedTasks.length > 0 ? 'Action Required' : 'Clean'}
                </span>
              </div>

              {blockedTasks.length === 0 ? (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    padding: '1rem 0',
                    textAlign: 'center',
                  }}
                >
                  🛡️ Zero tasks currently in blocked state for this project.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {blockedTasks.map((bt) => (
                    <div
                      key={bt.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {bt.title}
                        </span>
                        <span
                          className={
                            bt.priority === 'urgent' ? 'badge badge-danger' : 'badge badge-warning'
                          }
                        >
                          {bt.priority}
                        </span>
                      </div>
                      {bt.description && (
                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.45rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {bt.description}
                        </p>
                      )}
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Assigned Owner: <strong>{bt.assignedUserName || 'Unassigned'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Approvals Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.75rem',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pending Release Approvals ({pendingApprovals.length})
                </h3>
                <span
                  className={agingApprovals.length > 0 ? 'badge badge-danger' : 'badge badge-info'}
                >
                  {agingApprovals.length > 0 ? 'SLA Breached' : 'Pending'}
                </span>
              </div>

              {pendingApprovals.length === 0 ? (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    padding: '1rem 0',
                    textAlign: 'center',
                  }}
                >
                  ✓ All operational approval gates decided. Zero pending reviews.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingApprovals.map((ap) => {
                    const hours = Math.round(
                      (Date.now() - new Date(ap.createdAt).getTime()) / 3600000,
                    );
                    const isAging = hours >= 48;

                    return (
                      <div
                        key={ap.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-subtle)',
                          border: `1px solid ${isAging ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {ap.title}
                          </span>
                          <span className={isAging ? 'badge badge-danger' : 'badge badge-info'}>
                            {isAging ? `Aging (${Math.round(hours / 24)}d)` : `${hours}h`}
                          </span>
                        </div>
                        {ap.notes && (
                          <p
                            style={{
                              fontSize: '0.82rem',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.45rem',
                              lineHeight: 1.4,
                            }}
                          >
                            {ap.notes}
                          </p>
                        )}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Requested by: <strong>{ap.requestedByName || 'Team Member'}</strong> •{' '}
                          {new Date(ap.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Full Deliverables List Grouped by Status */}
          <div className="card" style={{ padding: '1.5rem' }}>
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  All Stream Deliverables ({tasks.length})
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Grouped breakdown of deliverables across execution stages
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem' }}>
                <span className="badge badge-danger">{overdueTasks.length} Overdue</span>
                <span className="badge badge-warning">{blockedTasks.length} Blocked</span>
                <span className="badge badge-info">
                  {inProgressTasks.length + reviewTasks.length} Active
                </span>
                <span className="badge badge-success">{completedTasks.length} Done</span>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">Zero Tasks Logged</div>
                <p className="empty-desc">
                  No deliverables have been added to this stream yet. Use the Tasks Workspace to
                  create new work items.
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
                      <th style={{ padding: '0.75rem 0.65rem' }}>Deliverable</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Priority</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Assigned Owner</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>Target Due Date</th>
                      <th style={{ padding: '0.75rem 0.65rem' }}>SLA Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const isOverdue =
                        task.status !== 'done' &&
                        task.dueDate &&
                        new Date(task.dueDate) < new Date();
                      const dueText = task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : 'No date set';

                      return (
                        <tr
                          key={task.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div
                                style={{
                                  fontSize: '0.76rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '0.15rem',
                                }}
                              >
                                {task.description.slice(0, 80)}...
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <span
                              className={`badge ${
                                task.status === 'done'
                                  ? 'badge-success'
                                  : task.status === 'blocked'
                                    ? 'badge-danger'
                                    : task.status === 'in_progress'
                                      ? 'badge-info'
                                      : 'badge-secondary'
                              }`}
                              style={{ textTransform: 'capitalize' }}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            <span
                              className={`badge ${
                                task.priority === 'urgent'
                                  ? 'badge-danger'
                                  : task.priority === 'high'
                                    ? 'badge-warning'
                                    : 'badge-info'
                              }`}
                              style={{ textTransform: 'capitalize' }}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '0.85rem 0.65rem',
                              color: task.assignedUserName
                                ? 'var(--text-primary)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {task.assignedUserName || 'Unassigned'}
                          </td>
                          <td
                            style={{
                              padding: '0.85rem 0.65rem',
                              color: isOverdue ? '#ef4444' : 'var(--text-muted)',
                              fontSize: '0.82rem',
                            }}
                          >
                            {dueText}
                          </td>
                          <td style={{ padding: '0.85rem 0.65rem' }}>
                            {isOverdue ? (
                              <span className="badge badge-danger">⚠️ SLA Breached</span>
                            ) : task.status === 'done' ? (
                              <span className="badge badge-success">✓ Completed</span>
                            ) : task.status === 'blocked' ? (
                              <span className="badge badge-warning">🚫 Blocked</span>
                            ) : (
                              <span className="badge badge-info">On Schedule</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

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
          iBirds AI Delivery Intelligence • Salesforce &amp; Cloud Delivery Command Center
        </div>
      </footer>
    </div>
  );
}

function inferPracticeArea(project: Project): string {
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
