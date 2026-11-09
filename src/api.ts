import { API_BASE_URL } from './config';
import type { Analytics, AnalyticsPeriod, Bank, Expense, ExpenseGroup, ExpenseYear, MobileSession, Person, SalaryEntry, Workspace, Member, Role, OptionKind, OptionLists } from './types';

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

// The session owner (SessionProvider) registers itself here so every request can
// attach the current token and, on TOKEN_EXPIRED, refresh once and retry.
type AuthBridge = {
  get: () => MobileSession | null;
  set: (session: MobileSession | null) => Promise<void> | void;
};
let bridge: AuthBridge | null = null;
export const bindAuth = (b: AuthBridge | null) => { bridge = b; };

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Body = Record<string, unknown> | null;

async function send<T>(method: Method, path: string, body: Body, token?: string): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('EXPO_PUBLIC_API_BASE_URL is not configured.', 500);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  if (!response.ok) throw new ApiError(data?.error || 'Request failed', response.status, data?.code);
  return data as T;
}

// One refresh at a time: concurrent 401s share the same refresh call.
let refreshing: Promise<MobileSession> | null = null;
function refreshSession(): Promise<MobileSession> {
  if (!refreshing) {
    refreshing = (async () => {
      const current = bridge?.get();
      if (!current) throw new ApiError('Not signed in', 401);
      try {
        const next = await send<{ accessToken: string; refreshToken: string }>('POST', '/auth/refresh', { refreshToken: current.refreshToken });
        const session = { ...current, accessToken: next.accessToken, refreshToken: next.refreshToken };
        await bridge?.set(session);
        return session;
      } catch (error) {
        await bridge?.set(null); // refresh failed: sign out
        throw error;
      }
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request<T>(method: Method, path: string, body: Body = null): Promise<T> {
  const session = bridge?.get();
  try {
    return await send<T>(method, path, body, session?.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && error.code === 'TOKEN_EXPIRED' && session) {
      const next = await refreshSession();
      return send<T>(method, path, body, next.accessToken);
    }
    throw error;
  }
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: Body = {}) => request<T>('POST', path, body);
const put = <T>(path: string, body: Body = {}) => request<T>('PUT', path, body);
const del = <T>(path: string) => request<T>('DELETE', path);

const qs = (params: Record<string, string | undefined | null>) => {
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return q ? `?${q}` : '';
};
const w = (workspaceId: string) => `/workspaces/${workspaceId}`;

// ── Auth (unauthenticated calls) ─────────────────────────────────────────────
export const login = (email: string, password: string) => send<any>('POST', '/auth/login', { email, password });
export const signup = (name: string, email: string, password: string) => send<any>('POST', '/auth/signup', { name, email, password });
export const forgotPassword = (email: string) => send<{ message: string }>('POST', '/auth/forgot-password', { email });
export const resetPassword = (email: string, code: string, newPassword: string) =>
  send<{ message: string }>('POST', '/auth/reset-password', { email, code, newPassword });
export const updateProfile = (change: { name?: string; phone?: string | null }) =>
  put<{ user: MobileSession['user'] }>('/auth/profile', change);
export const changePassword = (currentPassword: string, newPassword: string) =>
  post<{ message: string; accessToken: string; refreshToken: string }>('/auth/change-password', { currentPassword, newPassword });
export const logoutRemote = (refreshToken: string) => post('/auth/logout', { refreshToken });
// Permanently deletes the signed-in account (password is re-checked on the server).
export const deleteAccount = (password: string) =>
  post<{ message: string; deletedWorkspaces: number; transferredWorkspaces: number }>('/auth/delete-account', { password });

// ── Workspaces ───────────────────────────────────────────────────────────────
export const getWorkspaces = () => get<Workspace[]>('/workspaces');
export const inviteMember = (workspaceId: string, email: string, role: string) => post(`${w(workspaceId)}/invite`, { email, role });
export const getOptions = (workspaceId: string) => get<OptionLists>(`${w(workspaceId)}/options`);
export const addOption = (workspaceId: string, kind: OptionKind, name: string) => post(`${w(workspaceId)}/options`, { kind, name });
export const renameOption = (workspaceId: string, id: string, name: string) => put(`${w(workspaceId)}/options/${id}`, { name });
export const removeOption = (workspaceId: string, id: string) => del(`${w(workspaceId)}/options/${id}`);
export const listMembers = (workspaceId: string) => get<Member[]>(`${w(workspaceId)}/members`);
export const updateMember = (workspaceId: string, userId: string, change: { role?: Role; blocked?: boolean }) =>
  put<{ userId: string; role: Role; blocked: boolean }>(`${w(workspaceId)}/members/${userId}`, change);
export const removeMember = (workspaceId: string, userId: string) => del(`${w(workspaceId)}/members/${userId}`);

// ── Analytics ────────────────────────────────────────────────────────────────
export const getAnalyticsAllTime = (workspaceId: string) => get<Analytics>(`${w(workspaceId)}/analytics/all-time`);
// One row per month (or per flat year): income, spending and surplus, oldest first.
export const getAnalyticsMonthly = (workspaceId: string) => get<AnalyticsPeriod[]>(`${w(workspaceId)}/analytics/monthly`);

// ── Expenses ─────────────────────────────────────────────────────────────────
const flag = (on?: boolean) => (on ? 'true' : undefined);
export const getPersons = (workspaceId: string) => get<Person[]>(`${w(workspaceId)}/persons`);
export const createPerson = (workspaceId: string, data: { name: string; color?: string; baseSalary?: number; hasPanel?: boolean }) =>
  post<Person>(`${w(workspaceId)}/persons`, data);

export const getYears = (workspaceId: string, includeArchived = false) =>
  get<ExpenseYear[]>(`${w(workspaceId)}/years${qs({ includeArchived: flag(includeArchived) })}`);
export const createYear = (workspaceId: string, label: string, hasSubgroups: boolean) => post<ExpenseYear>(`${w(workspaceId)}/years`, { label, hasSubgroups });
export const updateYear = (workspaceId: string, id: string, label: string) => put<ExpenseYear>(`${w(workspaceId)}/years/${id}`, { label });
export const archiveYear = (workspaceId: string, id: string) => post(`${w(workspaceId)}/years/${id}/archive`);
export const restoreYear = (workspaceId: string, id: string) => post(`${w(workspaceId)}/years/${id}/restore`);
export const deleteYear = (workspaceId: string, id: string) => del(`${w(workspaceId)}/years/${id}`);

const groupPath = (workspaceId: string, yearId: string) => `${w(workspaceId)}/years/${yearId}/groups`;
export const createGroup = (workspaceId: string, yearId: string, label: string) => post<ExpenseGroup>(groupPath(workspaceId, yearId), { label });
export const updateGroup = (workspaceId: string, yearId: string, id: string, label: string) => put<ExpenseGroup>(`${groupPath(workspaceId, yearId)}/${id}`, { label });
export const archiveGroup = (workspaceId: string, yearId: string, id: string) => post(`${groupPath(workspaceId, yearId)}/${id}/archive`);
export const restoreGroup = (workspaceId: string, yearId: string, id: string) => post(`${groupPath(workspaceId, yearId)}/${id}/restore`);
export const deleteGroup = (workspaceId: string, yearId: string, id: string) => del(`${groupPath(workspaceId, yearId)}/${id}`);

export const getExpenses = (workspaceId: string, yearId: string, groupId?: string | null, includeArchived = false) =>
  get<Expense[]>(`${w(workspaceId)}/expenses${qs({ yearId, groupId, includeArchived: flag(includeArchived) })}`);
export const createExpense = (workspaceId: string, data: Record<string, unknown>) => post<Expense>(`${w(workspaceId)}/expenses`, data);
export const updateExpense = (workspaceId: string, id: string, data: Record<string, unknown>) => put<Expense>(`${w(workspaceId)}/expenses/${id}`, data);
export const archiveExpense = (workspaceId: string, id: string) => post<Expense>(`${w(workspaceId)}/expenses/${id}/archive`);
export const restoreExpense = (workspaceId: string, id: string) => post<Expense>(`${w(workspaceId)}/expenses/${id}/restore`);
export const deleteExpense = (workspaceId: string, id: string) => del(`${w(workspaceId)}/expenses/${id}`);

export const getSalaries = (workspaceId: string, yearId: string, groupId?: string | null) =>
  get<SalaryEntry[]>(`${w(workspaceId)}/salary-entries${qs({ yearId, groupId })}`);
export const saveSalary = (workspaceId: string, data: { personId: string; yearId: string; groupId: string | null; amount: number }) =>
  post<SalaryEntry>(`${w(workspaceId)}/salary-entries`, data);
// Removes a person from one year/month (their salary entry), not from the workspace.
export const removeSalary = (workspaceId: string, p: { personId: string; yearId: string; groupId: string | null }) =>
  del(`${w(workspaceId)}/salary-entries${qs({ personId: p.personId, yearId: p.yearId, groupId: p.groupId })}`);

// ── Loans / investments / insurance / overview share one CRUD shape ──────────
export type Crud<T = any> = {
  list: (workspaceId: string) => Promise<T[]>;
  create: (workspaceId: string, data: Record<string, unknown>) => Promise<T>;
  update: (workspaceId: string, id: string, data: Record<string, unknown>) => Promise<T>;
  remove: (workspaceId: string, id: string) => Promise<unknown>;
};
const crud = (resource: string): Crud => ({
  list: (workspaceId) => get(`${w(workspaceId)}/${resource}`),
  create: (workspaceId, data) => post(`${w(workspaceId)}/${resource}`, data),
  update: (workspaceId, id, data) => put(`${w(workspaceId)}/${resource}/${id}`, data),
  remove: (workspaceId, id) => del(`${w(workspaceId)}/${resource}/${id}`),
});
export const loansApi = crud('loans');
export const investmentsApi = crud('investments');
export const insuranceApi = crud('insurance');
export const overviewApi = crud('overview');

// ── Banks (bank -> sections -> entries) ──────────────────────────────────────
export const banksApi = {
  list: (workspaceId: string) => get<Bank[]>(`${w(workspaceId)}/banks`),
  createBank: (workspaceId: string, name: string) => post(`${w(workspaceId)}/banks`, { name }),
  renameBank: (workspaceId: string, id: string, name: string) => put(`${w(workspaceId)}/banks/${id}`, { name }),
  removeBank: (workspaceId: string, id: string) => del(`${w(workspaceId)}/banks/${id}`),
  createSection: (workspaceId: string, bankId: string, name: string) => post(`${w(workspaceId)}/banks/${bankId}/sections`, { name }),
  removeSection: (workspaceId: string, bankId: string, id: string) => del(`${w(workspaceId)}/banks/${bankId}/sections/${id}`),
  createEntry: (workspaceId: string, bankId: string, sectionId: string, data: Record<string, unknown>) =>
    post(`${w(workspaceId)}/banks/${bankId}/sections/${sectionId}/entries`, data),
  updateEntry: (workspaceId: string, bankId: string, sectionId: string, id: string, data: Record<string, unknown>) =>
    put(`${w(workspaceId)}/banks/${bankId}/sections/${sectionId}/entries/${id}`, data),
  removeEntry: (workspaceId: string, bankId: string, sectionId: string, id: string) =>
    del(`${w(workspaceId)}/banks/${bankId}/sections/${sectionId}/entries/${id}`),
};
