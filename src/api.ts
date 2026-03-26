import { API_BASE_URL } from './config';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: Record<string, unknown> | null;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('EXPO_PUBLIC_API_BASE_URL is not configured.', 500);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(data?.error || 'Request failed', response.status, data?.code);
  }

  return data as T;
}

export function login(email: string, password: string) {
  return request<any>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function signup(name: string, email: string, password: string) {
  return request<any>('/auth/signup', {
    method: 'POST',
    body: { name, email, password },
  });
}

export function refreshAuth(refreshToken: string) {
  return request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function getWorkspaces(token: string) {
  return request<any[]>('/workspaces', { token });
}

export function getAnalyticsAllTime(workspaceId: string, token: string) {
  return request<{
    totalExpenses: number;
    expenseCount: number;
    totalDebt: number;
    totalInvested: number;
    investmentGain: number;
  }>(`/workspaces/${workspaceId}/analytics/all-time`, { token });
}

export function getPersons(workspaceId: string, token: string) {
  return request<Array<{ id: string; name: string; color?: string | null; hasPanel?: boolean | null }>>(
    `/workspaces/${workspaceId}/persons`,
    { token }
  );
}

export function getYears(workspaceId: string, token: string) {
  return request<Array<{ id: string; label: string; status?: string | null }>>(
    `/workspaces/${workspaceId}/years`,
    { token }
  );
}
