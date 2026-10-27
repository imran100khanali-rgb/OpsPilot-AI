'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, loginUser, logoutUser } from '../lib/api-client';
import { User, Organization } from '@opspilot/shared';

export interface NavbarProps {
  onLoginSuccess?: (user: User, organization: Organization) => void;
  onLogout?: () => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Acme Director',
    role: 'Director',
    email: 'director@acme.example.com',
    password: 'DemoPass123!',
  },
  {
    label: 'Acme Manager',
    role: 'Manager',
    email: 'manager@acme.example.com',
    password: 'DemoPass123!',
  },
  {
    label: 'Globex Admin',
    role: 'Admin',
    email: 'admin@globex.example.com',
    password: 'DemoPass123!',
  },
];

export const Navbar: React.FC<NavbarProps> = ({ onLoginSuccess, onLogout }) => {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);

  // Login Modal State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDev = process.env.NODE_ENV !== 'production';

  const checkAuth = useCallback(async () => {
    const res = await getCurrentUser();
    if (res.data) {
      setUser(res.data.user);
      setOrganization(res.data.organization);
    } else {
      setUser(null);
      setOrganization(null);
    }
  }, []);

  useEffect(() => {
    // Check saved theme preference
    const savedTheme = localStorage.getItem('opspilot_theme');
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }

    void checkAuth();

    // Listen for global open-login request from other pages
    const handleOpenLogin = () => {
      setLoginError(null);
      setIsLoginOpen(true);
    };

    window.addEventListener('opspilot:open-login', handleOpenLogin);
    return () => {
      window.removeEventListener('opspilot:open-login', handleOpenLogin);
    };
  }, [checkAuth]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('opspilot_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('opspilot_theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setOrganization(null);
    onLogout?.();
    window.dispatchEvent(new CustomEvent('opspilot:auth-change'));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    setLoginError(null);

    const res = await loginUser({ email, password });
    if (res.error) {
      setLoginError(res.error);
      setIsSubmitting(false);
      return;
    }

    if (res.data) {
      setUser(res.data.user);
      setOrganization(res.data.organization);
      setIsLoginOpen(false);
      setEmail('');
      setPassword('');
      setIsSubmitting(false);

      onLoginSuccess?.(res.data.user, res.data.organization);
      window.dispatchEvent(
        new CustomEvent('opspilot:auth-change', {
          detail: { user: res.data.user, organization: res.data.organization },
        }),
      );
    }
  };

  const fillDemoAccount = (demo: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setLoginError(null);
  };

  return (
    <>
      <header className="app-header">
        <div className="container header-inner">
          <div className="brand-section">
            <Link href="/" className="brand-logo">
              <div className="brand-icon">OP</div>
              <div>
                <div className="brand-title">OpsPilot AI</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Operations Intelligence
                </div>
              </div>
            </Link>

            <nav className="nav-links" aria-label="Main Navigation">
              <Link
                href="/"
                className={`nav-link ${pathname === '/' ? 'active' : ''}`}
                id="nav-dashboard"
              >
                Executive Dashboard
              </Link>
              <Link
                href="/projects"
                className={`nav-link ${pathname === '/projects' ? 'active' : ''}`}
                id="nav-projects"
              >
                Projects
              </Link>
              <Link
                href="/tasks"
                className={`nav-link ${pathname === '/tasks' ? 'active' : ''}`}
                id="nav-tasks"
              >
                Tasks & Operations
              </Link>
              <Link
                href="/copilot"
                className={`nav-link ${pathname === '/copilot' ? 'active' : ''}`}
                id="nav-copilot"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span style={{ fontSize: '0.85rem' }}>✨</span> Copilot
              </Link>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Authenticated user badge - rendered ONLY after confirming through /api/v1/auth/me */}
            {user && organization ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                }}
                id="user-session-badge"
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                  title="Session Active"
                />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {organization.name}
                </span>
                <span className="badge badge-info">{user.role}</span>
              </div>
            ) : null}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-secondary btn-sm"
              aria-label="Toggle Light and Dark Theme"
              id="theme-toggle-btn"
              style={{ padding: '0.4rem 0.75rem' }}
            >
              {isDark ? '☀️ Light' : '🌙 Dark'}
            </button>

            {/* Sign Out (if authenticated) or Sign In (if unauthenticated) */}
            {user ? (
              <button
                onClick={() => void handleLogout()}
                className="btn btn-secondary btn-sm"
                id="logout-btn"
                title="Log out session"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => {
                  setLoginError(null);
                  setIsLoginOpen(true);
                }}
                className="btn btn-primary btn-sm"
                id="nav-signin-btn"
                style={{ padding: '0.4rem 0.85rem' }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Sign In Modal */}
      {isLoginOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLoginOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '1.75rem',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2
                  id="login-modal-title"
                  style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}
                >
                  Sign In to OpsPilot AI
                </h2>
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    margin: '0.25rem 0 0',
                  }}
                >
                  Authenticate to access organization workspaces and KPIs.
                </p>
              </div>
              <button
                onClick={() => setIsLoginOpen(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--status-outage)',
                  fontSize: '0.84rem',
                  marginBottom: '1rem',
                }}
                role="alert"
                id="login-error-banner"
              >
                {loginError}
              </div>
            )}

            <form onSubmit={(e) => void handleLoginSubmit(e)}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="login-email"
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="login-email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.example.com"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="login-password"
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  id="login-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                id="login-submit-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            {/* Development-only Synthetic Demo Shortcuts (hidden in production) */}
            {isDev && (
              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Demo Accounts (Dev Only)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {DEMO_ACCOUNTS.map((demo) => (
                    <button
                      key={demo.email}
                      type="button"
                      onClick={() => fillDemoAccount(demo)}
                      style={{
                        textAlign: 'left',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      className="demo-shortcut-btn"
                    >
                      <span style={{ fontWeight: 600 }}>{demo.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{demo.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
