'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import {
  fetchCopilotStatus,
  fetchCopilotConversations,
  fetchCopilotConversation,
  deleteCopilotConversation,
  sendCopilotMessage,
} from '../../lib/api-client';
import {
  CopilotConversation,
  CopilotMessage,
  AiStatusResponse,
  SourceRecordReference,
  CopilotSuggestedAction,
} from '@opspilot/shared';

const SUGGESTED_QUESTIONS = [
  {
    icon: '🚨',
    title: 'Overdue Deliverables',
    query: 'What tasks or deliverables are currently overdue past SLA?',
  },
  {
    icon: '🚧',
    title: 'Blocked Projects',
    query: 'Which projects are currently blocked or have blocked tasks?',
  },
  {
    icon: '✍️',
    title: 'Pending Approvals',
    query: 'Are there any pending approvals requiring executive sign-off?',
  },
  {
    icon: '📊',
    title: 'Executive Metrics',
    query: 'Give me an executive summary of our operational metrics and completion rate.',
  },
  {
    icon: '💰',
    title: 'Receivables & Cash Flow',
    query: 'Do we have any overdue invoices or collection follow-ups?',
  },
];

export default function CopilotPage() {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load Copilot status and conversation list
  useEffect(() => {
    void fetchCopilotStatus().then((res) => {
      if (res.data) setStatus(res.data);
    });

    void loadConversations();
  }, []);

  const loadConversations = async () => {
    const res = await fetchCopilotConversations();
    if (res.data) {
      setConversations(res.data);
    }
  };

  const handleSelectConversation = async (convId: string) => {
    setActiveConvId(convId);
    setIsLoadingThread(true);
    setErrorMessage(null);

    const res = await fetchCopilotConversation(convId);
    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.data) {
      setMessages(res.data.messages);
    }
    setIsLoadingThread(false);
  };

  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setErrorMessage(null);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation thread?')) return;

    await deleteCopilotConversation(convId);
    if (activeConvId === convId) {
      handleNewConversation();
    }
    await loadConversations();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    setInputMessage('');
    setErrorMessage(null);
    setIsSending(true);

    // Optimistically add user message to UI
    const tempUserMsg: CopilotMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConvId || 'new',
      senderType: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const res = await sendCopilotMessage(text, activeConvId || undefined);

    if (res.error) {
      setErrorMessage(res.error);
      // Remove failed optimistic message or mark it
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          conversationId: activeConvId || 'new',
          senderType: 'assistant',
          content: `⚠️ Failed to get answer: ${res.error}`,
          limitations: ['Network or provider error occurred.'],
          createdAt: new Date().toISOString(),
        },
      ]);
    } else if (res.data) {
      const data = res.data;
      if (!activeConvId) {
        setActiveConvId(data.conversationId);
        void loadConversations();
      }

      // Add assistant response
      const assistantMsg: CopilotMessage = {
        id: data.messageId,
        conversationId: data.conversationId,
        senderType: 'assistant',
        content: data.answer,
        sourceRecords: data.sourceRecords,
        limitations: data.limitations,
        suggestedActions: data.suggestedActions,
        toolCallsExecuted: data.toolCallsExecuted,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <>
      <Navbar />
      <main className="container" style={{ padding: '1.5rem 0', maxWidth: '1400px' }}>
        {/* Header / Mode Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>✨</span> OpsPilot AI Business Copilot
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Natural-language operational intelligence grounded in parameterized organization data.
            </p>
          </div>

          {/* AI Provider Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              backgroundColor: status?.hasCredentials
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${status?.hasCredentials ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: status?.hasCredentials ? 'var(--status-operational)' : '#f59e0b',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: status?.hasCredentials ? 'var(--status-operational)' : '#d97706',
              }}
            >
              {status?.hasCredentials
                ? `Active: OpenAI (${status.model})`
                : 'Local Grounded Intelligence Mode'}
            </span>
          </div>
        </div>

        {/* Credentials Setup Warning (if no credentials configured) */}
        {status && !status.hasCredentials && (
          <div
            className="card"
            style={{
              padding: '0.9rem 1.25rem',
              marginBottom: '1.25rem',
              borderLeft: '4px solid #f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Notice:</strong> <code>OPENAI_API_KEY</code> is not configured. The copilot is
              running using the <strong>Local Deterministic Engine</strong>. All operational
              queries, approved tools, tenant isolation, and grounded responses are fully
              functional.
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Set <code>OPENAI_API_KEY=sk-...</code> in <code>.env</code> to switch to external LLM
              provider.
            </div>
          </div>
        )}

        {/* Main Workspace Layout: Sidebar + Chat Feed */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '1.25rem',
            minHeight: '650px',
            alignItems: 'stretch',
          }}
        >
          {/* Left Sidebar: Threads */}
          <div
            className="card"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '750px',
            }}
          >
            <button
              onClick={handleNewConversation}
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}
              id="btn-new-thread"
            >
              + New Conversation
            </button>

            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Recent Inquiries
            </div>

            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {conversations.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                  No saved conversations yet.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => void handleSelectConversation(conv.id)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="thread-item"
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {conv.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(conv.updatedAt).toLocaleDateString()} • {conv.messageCount || 0}{' '}
                          msgs
                        </div>
                      </div>

                      <button
                        onClick={(e) => void handleDeleteConversation(conv.id, e)}
                        title="Delete conversation"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '4px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Area: Messages + Input Bar */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '750px',
              position: 'relative',
            }}
          >
            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--status-outage)',
                  fontSize: '0.85rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Conversation Feed */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {isLoadingThread ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem',
                    padding: '1rem',
                  }}
                >
                  <div className="skeleton" style={{ height: '40px', width: '60%' }} />
                  <div className="skeleton" style={{ height: '100px', width: '90%' }} />
                  <div className="skeleton" style={{ height: '50px', width: '75%' }} />
                </div>
              ) : messages.length === 0 ? (
                /* Empty state with suggested prompt cards */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                      marginBottom: '1rem',
                    }}
                  >
                    ✨
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    How can OpsPilot assist your team today?
                  </h2>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.88rem',
                      maxWidth: '520px',
                      marginBottom: '1.75rem',
                    }}
                  >
                    Ask questions regarding active projects, overdue SLAs, dependency blockers, and
                    executive approvals. All insights are organization-scoped and grounded.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '0.75rem',
                      width: '100%',
                      maxWidth: '850px',
                    }}
                  >
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => void handleSendMessage(q.query)}
                        style={{
                          textAlign: 'left',
                          padding: '0.85rem 1rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          transition: 'all 0.15s ease',
                        }}
                        className="suggested-card"
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                        >
                          <span>{q.icon}</span>
                          <span>{q.title}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {q.query}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.senderType === 'user';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {isUser ? 'You' : 'OpsPilot AI Business Copilot'}
                      </div>

                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '0.85rem 1.15rem',
                          borderRadius: isUser
                            ? '0.75rem 0.75rem 0 0.75rem'
                            : '0.75rem 0.75rem 0.75rem 0',
                          backgroundColor: isUser ? 'var(--primary)' : 'var(--bg)',
                          color: isUser ? '#ffffff' : 'var(--text-primary)',
                          border: isUser ? 'none' : '1px solid var(--border)',
                          lineHeight: 1.5,
                          fontSize: '0.9rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}

                        {/* Grounded Clickable Source Records */}
                        {msg.sourceRecords && msg.sourceRecords.length > 0 && (
                          <div
                            style={{
                              marginTop: '0.85rem',
                              paddingTop: '0.75rem',
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: 'var(--text-secondary)',
                                marginBottom: '0.4rem',
                              }}
                            >
                              Grounded Source Records ({msg.sourceRecords.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {msg.sourceRecords.map((rec) => {
                                let targetHref = '/';
                                if (rec.type === 'project')
                                  targetHref = `/projects?search=${encodeURIComponent(rec.name)}`;
                                if (rec.type === 'task')
                                  targetHref = `/tasks?search=${encodeURIComponent(rec.name)}`;

                                return (
                                  <Link
                                    key={rec.id}
                                    href={targetHref}
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '0.25rem 0.55rem',
                                      borderRadius: '0.25rem',
                                      backgroundColor: 'var(--surface)',
                                      border: '1px solid var(--border)',
                                      color: 'var(--primary)',
                                      textDecoration: 'none',
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                    }}
                                  >
                                    <span
                                      style={{
                                        textTransform: 'capitalize',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      [{rec.type}]
                                    </span>
                                    <span>{rec.name}</span>
                                    {rec.status && (
                                      <span
                                        style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                                      >
                                        ({rec.status})
                                      </span>
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Suggested Actions */}
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.4rem',
                            }}
                          >
                            {msg.suggestedActions.map((act) => (
                              <Link
                                key={act.id}
                                href={act.targetUrl}
                                className="btn btn-outline"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.3rem 0.65rem',
                                  textDecoration: 'none',
                                }}
                              >
                                ↗ {act.label}
                              </Link>
                            ))}
                          </div>
                        )}

                        {/* Grounding & Limitations Notice */}
                        {msg.limitations && msg.limitations.length > 0 && (
                          <div
                            style={{
                              marginTop: '0.6rem',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                            }}
                          >
                            ℹ️ {msg.limitations.join(' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing / Processing Indicator */}
              {isSending && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    OpsPilot AI Copilot
                  </div>
                  <div
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '0.75rem 0.75rem 0.75rem 0',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="spinner" style={{ width: '14px', height: '14px' }} />
                    <span>Executing parameterized tools and synthesizing grounded response...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
                style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}
              >
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about projects, overdue work, tasks, or approvals..."
                  disabled={isSending}
                  rows={2}
                  id="copilot-input-textarea"
                  style={{
                    flex: 1,
                    resize: 'none',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    lineHeight: 1.4,
                  }}
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="btn btn-primary"
                  id="btn-send-copilot"
                  style={{
                    height: '46px',
                    padding: '0 1.25rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                  }}
                >
                  {isSending ? 'Sending...' : 'Send ↵'}
                </button>
              </form>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.35rem',
                  textAlign: 'right',
                }}
              >
                Press{' '}
                <kbd
                  style={{
                    padding: '0.1rem 0.3rem',
                    borderRadius: '3px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Enter
                </kbd>{' '}
                to send • Strict organization data isolation enforced
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
