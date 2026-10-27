'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '../../components/Navbar';
import {
  fetchTasks,
  fetchProjects,
  createTask,
  updateTask,
  deleteTask,
} from '../../lib/api-client';
import { Task, Project, TaskStatus, TaskPriority } from '@opspilot/shared';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Pagination State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Form State
  const [formProjectId, setFormProjectId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load available projects for selection
  useEffect(() => {
    void fetchProjects({ limit: 50 }).then((res) => {
      if (res.data) {
        setProjects(res.data.items);
      }
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const res = await fetchTasks({
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      priority: priority !== 'all' ? priority : undefined,
      projectId: selectedProjectId || undefined,
      isOverdue: isOverdueOnly || undefined,
      sortBy,
      sortOrder,
      page,
      limit: 10,
    });

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.data) {
      setTasks(res.data.items);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.total);
    }
    setLoading(false);
  }, [search, status, priority, selectedProjectId, isOverdueOnly, sortBy, sortOrder, page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleOpenCreate = () => {
    setFormProjectId(projects[0]?.id || '');
    setFormTitle('');
    setFormDescription('');
    setFormStatus('todo');
    setFormPriority('medium');
    setFormDueDate('');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (t: Task) => {
    setEditingTask(t);
    setFormProjectId(t.projectId);
    setFormTitle(t.title);
    setFormDescription(t.description || '');
    setFormStatus(t.status);
    setFormPriority(t.priority);
    setFormDueDate(t.dueDate ? t.dueDate.split('T')[0]! : '');
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId) {
      setFormError('Please select a project');
      return;
    }
    if (!formTitle.trim() || formTitle.trim().length < 2) {
      setFormError('Task title must be at least 2 characters');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await createTask({
      projectId: formProjectId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
    });

    setSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setShowCreateModal(false);
      void loadTasks();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!formTitle.trim() || formTitle.trim().length < 2) {
      setFormError('Task title must be at least 2 characters');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await updateTask(editingTask.id, {
      projectId: formProjectId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
    });

    setSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setEditingTask(null);
      void loadTasks();
    }
  };

  const handleQuickStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus });
    void loadTasks();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    setSubmitting(true);

    const res = await deleteTask(deletingTask.id);
    setSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setDeletingTask(null);
      void loadTasks();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '1.75rem 0 3rem' }}>
        <div className="container">
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
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
                Tasks & Operational Workstream
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Track SLA deadlines, prioritize urgent tasks, and manage operational execution.
              </p>
            </div>

            <button onClick={handleOpenCreate} className="btn btn-primary" id="btn-create-task">
              + New Task
            </button>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                color: 'var(--status-danger-text)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Toolbar: Search, Filters, Overdue toggle, Sorting */}
          <div className="toolbar-bar">
            {/* Search */}
            <div className="search-input-wrap">
              <label htmlFor="task-search" style={{ display: 'none' }}>
                Search tasks
              </label>
              <input
                id="task-search"
                type="text"
                className="form-control"
                placeholder="🔍 Search tasks..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Project Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label htmlFor="task-project-filter" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Project:
              </label>
              <select
                id="task-project-filter"
                className="form-control"
                style={{ width: '160px' }}
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label htmlFor="task-status-filter" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Status:
              </label>
              <select
                id="task-status-filter"
                className="form-control"
                style={{ width: '120px' }}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label
                htmlFor="task-priority-filter"
                style={{ fontSize: '0.82rem', fontWeight: 600 }}
              >
                Priority:
              </label>
              <select
                id="task-priority-filter"
                className="form-control"
                style={{ width: '110px' }}
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Overdue Only Checkbox */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                color: isOverdueOnly ? '#ef4444' : 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                id="task-overdue-checkbox"
                checked={isOverdueOnly}
                onChange={(e) => {
                  setIsOverdueOnly(e.target.checked);
                  setPage(1);
                }}
              />
              ⚠️ Overdue Only
            </label>

            {/* Sorting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label htmlFor="task-sort-by" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Sort:
              </label>
              <select
                id="task-sort-by"
                className="form-control"
                style={{ width: '120px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="title">Title</option>
                <option value="created_at">Date Created</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-secondary btn-sm"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                {sortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>

            {/* Total Count */}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {totalCount} task{totalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table Container */}
          <div className="table-container">
            <table className="table" aria-label="Tasks Workstream Catalog">
              <thead>
                <tr>
                  <th>Task Name & Description</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Assignee</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '16px', width: '70%', marginBottom: '0.3rem' }}
                        />
                        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: '14px', width: '90px' }} />
                      </td>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '20px', width: '60px', borderRadius: '10px' }}
                        />
                      </td>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '20px', width: '80px', borderRadius: '10px' }}
                        />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: '14px', width: '80px' }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: '14px', width: '90px' }} />
                      </td>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '28px', width: '90px', marginLeft: 'auto' }}
                        />
                      </td>
                    </tr>
                  ))
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <div className="empty-title">No Tasks Found</div>
                        <p className="empty-desc">
                          {search || status !== 'all' || priority !== 'all' || isOverdueOnly
                            ? 'No tasks match your filter criteria. Try resetting your filters.'
                            : 'No tasks have been assigned yet. Create your first operational task to start tracking work.'}
                        </p>
                        <button onClick={handleOpenCreate} className="btn btn-primary">
                          + Create Task
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} id={`task-row-${task.id}`}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.15rem',
                            }}
                          >
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-subtle)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {task.projectName || 'General Workstream'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            task.priority === 'urgent'
                              ? 'badge-danger'
                              : task.priority === 'high'
                                ? 'badge-warning'
                                : 'badge-info'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <select
                          className="form-control"
                          style={{
                            width: '120px',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.78rem',
                            backgroundColor:
                              task.status === 'done'
                                ? 'var(--status-success-bg)'
                                : task.status === 'blocked'
                                  ? 'var(--status-danger-bg)'
                                  : 'var(--bg-input)',
                            borderColor:
                              task.status === 'done'
                                ? 'var(--status-success-border)'
                                : task.status === 'blocked'
                                  ? 'var(--status-danger-border)'
                                  : 'var(--border-color)',
                          }}
                          value={task.status}
                          onChange={(e) =>
                            void handleQuickStatusChange(task, e.target.value as TaskStatus)
                          }
                          aria-label={`Change status for task ${task.title}`}
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td>
                        {task.dueDate ? (
                          <div>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: task.isOverdue ? '#ef4444' : 'var(--text-secondary)',
                                fontWeight: task.isOverdue ? 700 : 500,
                              }}
                            >
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                            {task.isOverdue && (
                              <span
                                className="badge badge-danger"
                                style={{ fontSize: '0.65rem', marginTop: '0.15rem' }}
                              >
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            No Due Date
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {task.assignedUserName || 'Unassigned'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleOpenEdit(task)}
                            className="btn btn-secondary btn-sm"
                            id={`btn-edit-task-${task.id}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingTask(task)}
                            className="btn btn-secondary btn-sm"
                            id={`btn-delete-task-${task.id}`}
                            style={{ color: 'var(--status-danger-text)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.25rem',
                fontSize: '0.85rem',
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                ← Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <div className="modal-content">
            <h2
              id="create-task-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}
            >
              Create New Task
            </h2>

            {formError && (
              <div
                style={{
                  backgroundColor: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="create-task-project" className="form-label">
                  Project <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  id="create-task-project"
                  className="form-control"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="create-task-title-input" className="form-label">
                  Task Title <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="create-task-title-input"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Conduct automated failover simulation"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-task-desc" className="form-label">
                  Description
                </label>
                <textarea
                  id="create-task-desc"
                  className="form-control"
                  rows={3}
                  placeholder="Actionable steps, test procedures, and acceptance criteria..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="create-task-priority" className="form-label">
                    Priority
                  </label>
                  <select
                    id="create-task-priority"
                    className="form-control"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="create-task-status" className="form-label">
                    Status
                  </label>
                  <select
                    id="create-task-status"
                    className="form-control"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="create-task-due" className="form-label">
                  Due Date
                </label>
                <input
                  id="create-task-due"
                  type="date"
                  className="form-control"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.6rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-task-title"
        >
          <div className="modal-content">
            <h2
              id="edit-task-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}
            >
              Edit Task: {editingTask.title}
            </h2>

            {formError && (
              <div
                style={{
                  backgroundColor: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label htmlFor="edit-task-project" className="form-label">
                  Project <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  id="edit-task-project"
                  className="form-control"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-task-title-input" className="form-label">
                  Task Title <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="edit-task-title-input"
                  type="text"
                  className="form-control"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-task-desc" className="form-label">
                  Description
                </label>
                <textarea
                  id="edit-task-desc"
                  className="form-control"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="edit-task-priority" className="form-label">
                    Priority
                  </label>
                  <select
                    id="edit-task-priority"
                    className="form-control"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-task-status" className="form-label">
                    Status
                  </label>
                  <select
                    id="edit-task-status"
                    className="form-control"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-task-due" className="form-label">
                  Due Date
                </label>
                <input
                  id="edit-task-due"
                  type="date"
                  className="form-control"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.6rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h2
              id="delete-task-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                marginBottom: '0.6rem',
                color: '#b91c1c',
              }}
            >
              Confirm Task Deletion
            </h2>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
              }}
            >
              Are you sure you want to delete task <strong>&quot;{deletingTask.title}&quot;</strong>
              ? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
