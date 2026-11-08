import * as api from '../api';
import type { MobileSession } from '../types';

jest.mock('../config', () => ({ API_BASE_URL: 'http://api.test/api/v1', HAS_API_CONFIG: true }));

type Reply = { status?: number; body?: unknown; json?: boolean };
const reply = ({ status = 200, body = {}, json = true }: Reply = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' && json ? 'application/json' : null) },
  json: async () => body,
});

const session = (over: Partial<MobileSession> = {}): MobileSession => ({
  user: { id: 'u1', email: 'a@b.c', name: 'A' }, accessToken: 'access-1', refreshToken: 'refresh-1', workspaces: [], activeWorkspaceId: 'w1', ...over,
});

let current: MobileSession | null;
const setSession = jest.fn(async (s: MobileSession | null) => { current = s; });
const fetchMock = jest.fn();
const lastCall = (n = 0) => {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: url as string, method: init.method as string, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body) : undefined };
};

beforeEach(() => {
  current = session();
  api.bindAuth({ get: () => current, set: setSession });
  (global as any).fetch = fetchMock;
});
afterEach(() => api.bindAuth(null));

describe('request basics', () => {
  test('sends the Bearer token, JSON headers and the base URL', async () => {
    fetchMock.mockResolvedValueOnce(reply({ body: [] }));
    await api.getPersons('w1');
    expect(lastCall()).toMatchObject({ url: 'http://api.test/api/v1/workspaces/w1/persons', method: 'GET' });
    expect(lastCall().headers).toMatchObject({ Authorization: 'Bearer access-1', 'Content-Type': 'application/json' });
  });

  test('login and signup are sent without a token', async () => {
    fetchMock.mockResolvedValue(reply({ body: { accessToken: 'x' } }));
    await api.login('a@b.c', 'pw');
    await api.signup('A', 'a@b.c', 'password1');
    expect(lastCall(0).headers.Authorization).toBeUndefined();
    expect(lastCall(0).body).toEqual({ email: 'a@b.c', password: 'pw' });
    expect(lastCall(1).url).toMatch(/\/auth\/signup$/);
  });

  test('server error messages become ApiError with status and code', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 400, body: { error: 'label required', code: 'BAD' } }));
    await expect(api.createYear('w1', '', true)).rejects.toMatchObject({ name: 'ApiError', message: 'label required', status: 400, code: 'BAD' });
  });

  test('a non-JSON failure falls back to a generic message', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 502, json: false }));
    await expect(api.getYears('w1')).rejects.toMatchObject({ message: 'Request failed', status: 502 });
  });

  test('network failures propagate unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(api.getYears('w1')).rejects.toThrow('Network request failed');
  });
});

describe('token refresh', () => {
  const expired = () => reply({ status: 401, body: { error: 'Token expired', code: 'TOKEN_EXPIRED' } });

  test('an expired token is refreshed once, stored, and the request retried with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(reply({ body: { accessToken: 'access-2', refreshToken: 'refresh-2' } }))
      .mockResolvedValueOnce(reply({ body: [{ id: 'e1' }] }));

    await expect(api.getExpenses('w1', 'y1')).resolves.toEqual([{ id: 'e1' }]);

    expect(lastCall(1)).toMatchObject({ url: 'http://api.test/api/v1/auth/refresh', method: 'POST', body: { refreshToken: 'refresh-1' } });
    expect(lastCall(2).headers.Authorization).toBe('Bearer access-2');
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(current).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2', user: { id: 'u1' } });
  });

  test('simultaneous expired requests share a single refresh', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if (url.endsWith('/auth/refresh')) { refreshCalls += 1; return reply({ body: { accessToken: 'access-2', refreshToken: 'refresh-2' } }); }
      return init.headers.Authorization === 'Bearer access-1' ? expired() : reply({ body: { ok: true } });
    });
    const results = await Promise.all([api.getPersons('w1'), api.getYears('w1'), api.getExpenses('w1', 'y1')]);
    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  test('a failed refresh signs the user out and surfaces the error', async () => {
    fetchMock
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(reply({ status: 401, body: { error: 'Invalid or expired refresh token' } }));
    await expect(api.getYears('w1')).rejects.toMatchObject({ status: 401, message: 'Invalid or expired refresh token' });
    expect(setSession).toHaveBeenLastCalledWith(null);
    expect(current).toBeNull();
  });

  test('a 401 without TOKEN_EXPIRED is not retried', async () => {
    fetchMock.mockResolvedValueOnce(reply({ status: 401, body: { error: 'Invalid token' } }));
    await expect(api.getYears('w1')).rejects.toMatchObject({ message: 'Invalid token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSession).not.toHaveBeenCalled();
  });

  test('a second expiry after a successful refresh is not retried again (no loops)', async () => {
    fetchMock
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(reply({ body: { accessToken: 'access-2', refreshToken: 'refresh-2' } }))
      .mockResolvedValueOnce(expired());
    await expect(api.getYears('w1')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('expense endpoints', () => {
  beforeEach(() => fetchMock.mockResolvedValue(reply({ body: {} })));

  test('getYears only asks for archived items when requested', async () => {
    await api.getYears('w1');
    await api.getYears('w1', true);
    expect(lastCall(0).url).toMatch(/\/workspaces\/w1\/years$/);
    expect(lastCall(1).url).toMatch(/\/years\?includeArchived=true$/);
  });

  test('getExpenses builds its query from the scope', async () => {
    await api.getExpenses('w1', 'y1', 'g1');
    await api.getExpenses('w1', 'y1', null);
    await api.getExpenses('w1', 'y1', 'g1', true);
    expect(lastCall(0).url).toMatch(/\/expenses\?yearId=y1&groupId=g1$/);
    expect(lastCall(1).url).toMatch(/\/expenses\?yearId=y1$/);
    expect(lastCall(2).url).toMatch(/\/expenses\?yearId=y1&groupId=g1&includeArchived=true$/);
  });

  test('expense writes use the right verbs, paths and bodies', async () => {
    await api.createExpense('w1', { label: 'Rent', amount: 5 });
    await api.updateExpense('w1', 'e1', { status: 'done' });
    await api.archiveExpense('w1', 'e1');
    await api.restoreExpense('w1', 'e1');
    await api.deleteExpense('w1', 'e1');
    const calls = [0, 1, 2, 3, 4].map((i) => lastCall(i));
    expect(calls.map((c) => `${c.method} ${c.url.replace('http://api.test/api/v1', '')}`)).toEqual([
      'POST /workspaces/w1/expenses', 'PUT /workspaces/w1/expenses/e1', 'POST /workspaces/w1/expenses/e1/archive',
      'POST /workspaces/w1/expenses/e1/restore', 'DELETE /workspaces/w1/expenses/e1',
    ]);
    expect(calls[0].body).toEqual({ label: 'Rent', amount: 5 });
    expect(calls[1].body).toEqual({ status: 'done' });
  });

  test('year and month lifecycle endpoints', async () => {
    await api.createYear('w1', '2026', true);
    await api.updateYear('w1', 'y1', 'FY26');
    await api.archiveYear('w1', 'y1');
    await api.restoreYear('w1', 'y1');
    await api.deleteYear('w1', 'y1');
    await api.createGroup('w1', 'y1', 'Mar');
    await api.updateGroup('w1', 'y1', 'g1', 'March');
    await api.archiveGroup('w1', 'y1', 'g1');
    await api.restoreGroup('w1', 'y1', 'g1');
    await api.deleteGroup('w1', 'y1', 'g1');
    const sig = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `${lastCall(i).method} ${lastCall(i).url.replace('http://api.test/api/v1/workspaces/w1', '')}`);
    expect(sig).toEqual([
      'POST /years', 'PUT /years/y1', 'POST /years/y1/archive', 'POST /years/y1/restore', 'DELETE /years/y1',
      'POST /years/y1/groups', 'PUT /years/y1/groups/g1', 'POST /years/y1/groups/g1/archive', 'POST /years/y1/groups/g1/restore', 'DELETE /years/y1/groups/g1',
    ]);
    expect(lastCall(0).body).toEqual({ label: '2026', hasSubgroups: true });
    expect(lastCall(1).body).toEqual({ label: 'FY26' });
    expect(lastCall(6).body).toEqual({ label: 'March' });
  });

  test('salary and people endpoints', async () => {
    await api.saveSalary('w1', { personId: 'p1', yearId: 'y1', groupId: null, amount: 100 });
    await api.removeSalary('w1', { personId: 'p1', yearId: 'y1', groupId: 'g1' });
    await api.removeSalary('w1', { personId: 'p1', yearId: 'y1', groupId: null });
    await api.getSalaries('w1', 'y1', 'g1');
    await api.createPerson('w1', { name: 'Hari', color: '#000', baseSalary: 5, hasPanel: false });
    expect(lastCall(0)).toMatchObject({ method: 'POST', body: { personId: 'p1', yearId: 'y1', groupId: null, amount: 100 } });
    expect(lastCall(1)).toMatchObject({ method: 'DELETE' });
    expect(lastCall(1).url).toMatch(/\/salary-entries\?personId=p1&yearId=y1&groupId=g1$/);
    expect(lastCall(2).url).toMatch(/\/salary-entries\?personId=p1&yearId=y1$/);
    expect(lastCall(3).url).toMatch(/\/salary-entries\?yearId=y1&groupId=g1$/);
    expect(lastCall(4).body).toEqual({ name: 'Hari', color: '#000', baseSalary: 5, hasPanel: false });
  });

  test('ids are URL-encoded in query strings', async () => {
    await api.getExpenses('w1', 'a&b=c', null);
    expect(lastCall().url).toMatch(/yearId=a%26b%3Dc$/);
  });
});
