import {
  ApiResponse,
  DashboardSummaryResponse,
  DashboardTrendsResponse,
  HealthCheckResult,
  PaginatedResult,
  Project,
  Task,
  Approval,
  User,
  Organization,
  CopilotChatResponse,
  CopilotConversation,
  CopilotMessage,
  AiStatusResponse,
} from '@opspilot/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let cachedCsrfToken: string | null = null;

export function setCsrfToken(token: string): void {
  cachedCsrfToken = token;
}

export function getCsrfToken(): string | null {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)opspilot_csrf=([^;]*)/);
    if (match && match[1]) {
      cachedCsrfToken = decodeURIComponent(match[1]);
      return cachedCsrfToken;
    }
  }
  return null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    const method = options.method?.toUpperCase() || 'GET';
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isMutation) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const csrf = getCsrfToken();
      if (csrf) {
        headers.set('x-csrf-token', csrf);
      }
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // send and receive HTTP-only cookies
    });

    const json = (await res.json()) as
      ApiResponse<T> | { success: false; error: { message: string } };

    if (!res.ok || !json.success) {
      const msg = 'error' in json ? json.error.message : `HTTP ${res.status}`;
      return { data: null, error: msg };
    }

    return { data: (json as ApiResponse<T>).data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

// ----------------- Auth APIs -----------------
export async function loginUser(credentials: { email: string; password: string }) {
  const result = await request<{ user: User; organization: Organization; csrfToken: string }>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
  );

  if (result.data?.csrfToken) {
    setCsrfToken(result.data.csrfToken);
  }
  return result;
}

export async function getCurrentUser() {
  return request<{ user: User; organization: Organization }>('/api/v1/auth/me');
}

export async function logoutUser() {
  const res = await request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' });
  cachedCsrfToken = null;
  return res;
}

// ----------------- Health APIs -----------------
export async function fetchHealth(): Promise<HealthCheckResult | null> {
  const res = await request<HealthCheckResult>('/api/health');
  return res.data;
}

// ----------------- Dashboard APIs -----------------
export async function fetchDashboardSummary(
  params: {
    startDate?: string;
    endDate?: string;
    status?: string;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.status && params.status !== 'all') query.set('status', params.status);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return request<DashboardSummaryResponse>(`/api/v1/dashboard/summary${qs}`);
}

export async function fetchDashboardTrends() {
  return request<DashboardTrendsResponse>('/api/v1/dashboard/trends');
}

// ----------------- Projects APIs -----------------
export async function fetchProjects(
  params: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString() ? `?${query.toString()}` : '';
  return request<PaginatedResult<Project>>(`/api/v1/projects${qs}`);
}

export async function createProject(payload: {
  name: string;
  description?: string;
  status?: string;
}) {
  return request<Project>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProject(
  id: string,
  payload: { name?: string; description?: string; status?: string },
) {
  return request<Project>(`/api/v1/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(id: string) {
  return request<{ message: string }>(`/api/v1/projects/${id}`, {
    method: 'DELETE',
  });
}

// ----------------- Tasks APIs -----------------
export async function fetchTasks(
  params: {
    search?: string;
    status?: string;
    priority?: string;
    projectId?: string;
    isOverdue?: boolean;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.priority && params.priority !== 'all') query.set('priority', params.priority);
  if (params.projectId) query.set('projectId', params.projectId);
  if (params.isOverdue) query.set('isOverdue', 'true');
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString() ? `?${query.toString()}` : '';
  return request<PaginatedResult<Task>>(`/api/v1/tasks${qs}`);
}

export async function createTask(payload: {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedTo?: string | null;
}) {
  return request<Task>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(
  id: string,
  payload: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    assignedTo?: string | null;
    projectId?: string;
  },
) {
  return request<Task>(`/api/v1/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(id: string) {
  return request<{ message: string }>(`/api/v1/tasks/${id}`, {
    method: 'DELETE',
  });
}

// ----------------- Approvals APIs -----------------
export async function fetchApprovals() {
  return request<Approval[]>('/api/v1/approvals');
}

export async function reviewApproval(
  id: string,
  payload: { status: 'approved' | 'rejected'; notes?: string },
) {
  return request<Approval>(`/api/v1/approvals/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ----------------- Copilot APIs -----------------
export async function fetchCopilotStatus() {
  return request<AiStatusResponse>('/api/v1/copilot/status');
}

export async function fetchCopilotConversations() {
  return request<CopilotConversation[]>('/api/v1/copilot/conversations');
}

export async function createCopilotConversation(title?: string) {
  return request<CopilotConversation>('/api/v1/copilot/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function fetchCopilotConversation(id: string) {
  return request<{ conversation: CopilotConversation; messages: CopilotMessage[] }>(
    `/api/v1/copilot/conversations/${id}`,
  );
}

export async function deleteCopilotConversation(id: string) {
  return request<{ deleted: boolean }>(`/api/v1/copilot/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function sendCopilotMessage(message: string, conversationId?: string) {
  return request<CopilotChatResponse>('/api/v1/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
}
