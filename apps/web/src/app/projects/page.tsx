'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { fetchProjects, createProject, updateProject, deleteProject } from '../../lib/api-client';
import { Project, ProjectStatus } from '@opspilot/shared';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Pagination State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const res = await fetchProjects({
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      sortBy,
      sortOrder,
      page,
      limit: 8,
    });

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.data) {
      setProjects(res.data.items);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.total);
    }
    setLoading(false);
  }, [search, status, sortBy, sortOrder, page]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormStatus('active');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormStatus(p.status);
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formName.trim().length < 2) {
      setFormError('Project name must be at least 2 characters');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await createProject({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
    });

    setSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setShowCreateModal(false);
      void loadProjects();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!formName.trim() || formName.trim().length < 2) {
      setFormError('Project name must be at least 2 characters');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await updateProject(editingProject.id, {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
    });

    setSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setEditingProject(null);
      void loadProjects();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    setSubmitting(true);

    const res = await deleteProject(deletingProject.id);
    setSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setDeletingProject(null);
      void loadProjects();
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
                Projects Workspace
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Manage operational initiatives, tracked deliverables, and cross-team dependencies.
              </p>
            </div>

            <button onClick={handleOpenCreate} className="btn btn-primary" id="btn-create-project">
              + New Project
            </button>
          </div>

          {/* Error Message */}
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

          {/* Toolbar: Search, Filters, Sorting */}
          <div className="toolbar-bar">
            {/* Search */}
            <div className="search-input-wrap">
              <label htmlFor="project-search" style={{ display: 'none' }}>
                Search projects
              </label>
              <input
                id="project-search"
                type="text"
                className="form-control"
                placeholder="🔍 Search projects..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label
                htmlFor="project-status-filter"
                style={{ fontSize: '0.82rem', fontWeight: 600 }}
              >
                Status:
              </label>
              <select
                id="project-status-filter"
                className="form-control"
                style={{ width: '130px' }}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Sorting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="project-sort-by" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Sort By:
              </label>
              <select
                id="project-sort-by"
                className="form-control"
                style={{ width: '140px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at">Date Created</option>
                <option value="name">Project Name</option>
                <option value="status">Status</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-secondary btn-sm"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
              </button>
            </div>

            {/* Total Indicator */}
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {totalCount} project{totalCount !== 1 ? 's' : ''} found
            </span>
          </div>

          {/* Table Container */}
          <div className="table-container">
            <table className="table" aria-label="Projects Catalog">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Status</th>
                  <th>Task Progress</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '18px', width: '60%', marginBottom: '0.3rem' }}
                        />
                        <div className="skeleton" style={{ height: '12px', width: '40%' }} />
                      </td>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '22px', width: '70px', borderRadius: '12px' }}
                        />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: '14px', width: '120px' }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: '14px', width: '80px' }} />
                      </td>
                      <td>
                        <div
                          className="skeleton"
                          style={{ height: '28px', width: '90px', marginLeft: 'auto' }}
                        />
                      </td>
                    </tr>
                  ))
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <div className="empty-icon">📁</div>
                        <div className="empty-title">No Projects Found</div>
                        <p className="empty-desc">
                          {search || status !== 'all'
                            ? 'No projects match your current filters. Try resetting your search criteria.'
                            : 'Get started by creating your organization’s first operational project.'}
                        </p>
                        <button onClick={handleOpenCreate} className="btn btn-primary">
                          + Create Project
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  projects.map((proj) => {
                    const taskCount = proj.taskCount || 0;
                    const completedCount = proj.completedTaskCount || 0;
                    const blockedCount = proj.blockedTaskCount || 0;
                    const completionPct =
                      taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

                    return (
                      <tr key={proj.id} id={`project-row-${proj.id}`}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {proj.name}
                          </div>
                          {proj.description && (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                marginTop: '0.15rem',
                              }}
                            >
                              {proj.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              proj.status === 'active'
                                ? 'badge-success'
                                : proj.status === 'blocked'
                                  ? 'badge-danger'
                                  : proj.status === 'paused'
                                    ? 'badge-warning'
                                    : 'badge-info'
                            }`}
                          >
                            {proj.status}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div
                              style={{
                                width: '80px',
                                height: '6px',
                                backgroundColor: 'var(--border-color)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${completionPct}%`,
                                  height: '100%',
                                  backgroundColor: '#10b981',
                                }}
                              />
                            </div>
                            <span>
                              {completedCount}/{taskCount} tasks ({completionPct}%)
                            </span>
                            {blockedCount > 0 && (
                              <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                                {blockedCount} blocked
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(proj.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => handleOpenEdit(proj)}
                              className="btn btn-secondary btn-sm"
                              id={`btn-edit-project-${proj.id}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingProject(proj)}
                              className="btn btn-secondary btn-sm"
                              id={`btn-delete-project-${proj.id}`}
                              style={{ color: 'var(--status-danger-text)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
        >
          <div className="modal-content">
            <h2
              id="create-project-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}
            >
              Create New Project
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
                <label htmlFor="create-project-name" className="form-label">
                  Project Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="create-project-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Apollo Observability Upgrade"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-project-desc" className="form-label">
                  Description
                </label>
                <textarea
                  id="create-project-desc"
                  className="form-control"
                  rows={3}
                  placeholder="Operational scope, goals, and technical dependencies..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-project-status" className="form-label">
                  Initial Status
                </label>
                <select
                  id="create-project-status"
                  className="form-control"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
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
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title"
        >
          <div className="modal-content">
            <h2
              id="edit-project-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}
            >
              Edit Project: {editingProject.name}
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
                <label htmlFor="edit-project-name" className="form-label">
                  Project Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-project-desc" className="form-label">
                  Description
                </label>
                <textarea
                  id="edit-project-desc"
                  className="form-control"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-project-status" className="form-label">
                  Status
                </label>
                <select
                  id="edit-project-status"
                  className="form-control"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
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
                  onClick={() => setEditingProject(null)}
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
      {deletingProject && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h2
              id="delete-project-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                marginBottom: '0.6rem',
                color: '#b91c1c',
              }}
            >
              Confirm Project Deletion
            </h2>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
              }}
            >
              Are you sure you want to delete project{' '}
              <strong>&quot;{deletingProject.name}&quot;</strong>? This action will permanently
              remove all associated tasks and cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
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
                {submitting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
