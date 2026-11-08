// State and actions for the Expenses module. The screen only renders; every API call goes through here.
// Actions resolve to an error message (shown by the caller) or null on success.
import { useMemo, useState } from 'react';
import * as api from '../api';
import { useAsync } from '../hooks';
import { errorMessage, useSession } from '../session';
import type { Expense, ExpenseGroup, ExpenseYear, Person, SalaryEntry } from '../types';
import {
  ExpenseFilter, OTHER_INCOME, ParsedExpense, Scope, filterExpenses, inScope, isArchivedPeriod, isSpending, scopeFor, summarize, visibleGroups,
} from './logic';

// `key` says which year/month the data belongs to, so a screen never shows another month's numbers.
type Scoped = { key: string; expenses: Expense[]; salaries: SalaryEntry[] };
const EMPTY: Scoped = { key: '', expenses: [], salaries: [] };
const keyOf = (s: Scope | null, showArchived: boolean) => (s ? `${s.yearId}:${s.groupId ?? ''}:${showArchived}` : '');

// `focus` opens on a given year/month (e.g. coming from the Home dashboard) instead of the first one.
export function useExpenses(focus?: { yearId: string; groupId: string | null }) {
  const { workspace, canWrite, isAdmin } = useSession();
  const wid = workspace?.id ?? '';

  const [showArchived, setShowArchived] = useState(false);
  const [yearChoice, setYearChoice] = useState<string | null>(focus?.yearId ?? null);
  const [groupChoice, setGroupChoice] = useState<string | null>(focus?.groupId ?? null);
  const [filter, setFilter] = useState<ExpenseFilter>({ query: '', status: 'all', personId: '' });
  const [actionError, setActionError] = useState('');

  // Years (with their months) and people.
  const base = useAsync(async () => ({ years: await api.getYears(wid, showArchived), persons: await api.getPersons(wid) }), [wid, showArchived]);
  const years: ExpenseYear[] = base.data?.years ?? [];
  const persons: Person[] = base.data?.persons ?? [];

  const year = years.find((y) => y.id === yearChoice) ?? years[0] ?? null;
  const groups: ExpenseGroup[] = visibleGroups(year, showArchived);
  const group: ExpenseGroup | null = year?.hasSubgroups
    ? groups.find((g) => g.id === groupChoice) ?? groups.find((g) => !isArchivedPeriod(g)) ?? groups[0] ?? null
    : null;
  const scope: Scope | null = scopeFor(year, group);

  // Expenses and salaries for the selected year/month.
  const key = keyOf(scope, showArchived);
  const scoped = useAsync(async (): Promise<Scoped> => {
    if (!scope) return EMPTY;
    const [expenses, salaries] = await Promise.all([
      api.getExpenses(wid, scope.yearId, scope.groupId, showArchived),
      api.getSalaries(wid, scope.yearId, scope.groupId),
    ]);
    return { key, expenses: expenses.filter((e) => inScope(e, scope)), salaries };
  }, [wid, scope?.yearId, scope?.groupId, showArchived]);

  // Loaded data only counts when it is for the month on screen; until then we show a loader, not stale or zero numbers.
  const fresh = scoped.data?.key === key;

  const all = fresh ? scoped.data!.expenses : EMPTY.expenses;
  const salaries = fresh ? scoped.data!.salaries : EMPTY.salaries;

  const summary = useMemo(() => summarize(persons, salaries, all), [persons, salaries, all]);
  const spending = useMemo(() => all.filter(isSpending), [all]);
  const visible = useMemo(() => filterExpenses(spending, filter, persons), [spending, filter, persons]);
  const otherIncome = useMemo(() => all.filter((e) => !isSpending(e) && !e.isArchived), [all]);

  // ── plumbing ───────────────────────────────────────────────────────────────
  const refetchAll = () => Promise.all([base.refetch(), scoped.refetch()]);

  async function run(work: () => Promise<unknown>, then: 'scope' | 'all' = 'scope'): Promise<string | null> {
    try {
      await work();
      await (then === 'all' ? refetchAll() : scoped.refetch());
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }
  const needScope = (): Scope => {
    if (!scope) throw new Error('Select a year and month first.');
    return scope;
  };

  // ── periods ────────────────────────────────────────────────────────────────
  const addYear = (label: string, hasSubgroups: boolean) => run(async () => {
    const created = await api.createYear(wid, label, hasSubgroups);
    setYearChoice(created.id);
    setGroupChoice(null);
  }, 'all');

  const renameYear = (label: string) => run(() => api.updateYear(wid, needYear().id, label), 'all');
  const archiveYear = () => run(() => api.archiveYear(wid, needYear().id), 'all');
  const restoreYear = (id: string) => run(() => api.restoreYear(wid, id), 'all');
  const deleteYear = () => run(async () => {
    await api.deleteYear(wid, needYear().id);
    setYearChoice(null);
    setGroupChoice(null);
  }, 'all');

  const addMonth = (label: string) => run(async () => {
    const created = await api.createGroup(wid, needYear().id, label);
    setGroupChoice(created.id);
  }, 'all');
  const renameMonth = (label: string) => run(() => api.updateGroup(wid, needYear().id, needMonth().id, label), 'all');
  const archiveMonth = () => run(async () => {
    await api.archiveGroup(wid, needYear().id, needMonth().id);
    setGroupChoice(null);
  }, 'all');
  const restoreMonth = (id: string) => run(() => api.restoreGroup(wid, needYear().id, id), 'all');
  const deleteMonth = () => run(async () => {
    await api.deleteGroup(wid, needYear().id, needMonth().id);
    setGroupChoice(null);
  }, 'all');

  function needYear(): ExpenseYear {
    if (!year) throw new Error('Select a year first.');
    return year;
  }
  function needMonth(): ExpenseGroup {
    if (!group) throw new Error('Select a month first.');
    return group;
  }

  // ── expenses ───────────────────────────────────────────────────────────────
  const addExpense = (v: ParsedExpense) => run(() => {
    const s = needScope();
    return api.createExpense(wid, { ...v, yearId: s.yearId, groupId: s.groupId });
  });
  const editExpense = (id: string, v: ParsedExpense) => run(() => api.updateExpense(wid, id, { ...v }));
  const archiveExpense = (id: string) => run(() => api.archiveExpense(wid, id));
  const restoreExpense = (id: string) => run(() => api.restoreExpense(wid, id));
  const deleteExpense = (id: string) => run(() => api.deleteExpense(wid, id));

  // Tick/untick paid: update the screen at once, undo if the server refuses.
  const toggleStatus = async (e: Expense): Promise<string | null> => {
    const next = e.status === 'done' ? 'pending' : 'done';
    setActionError('');
    scoped.setData((d) => d && { ...d, expenses: d.expenses.map((x) => (x.id === e.id ? { ...x, status: next } : x)) });
    try {
      await api.updateExpense(wid, e.id, { status: next });
      return null;
    } catch (err) {
      await scoped.refetch();
      const message = errorMessage(err);
      setActionError(message);
      return message;
    }
  };

  // ── other income (stored as expenses with a marker category) ───────────────
  const addIncome = (label: string, amount: number) => run(() => {
    const s = needScope();
    return api.createExpense(wid, { label, amount, status: 'done', category: OTHER_INCOME, personId: null, yearId: s.yearId, groupId: s.groupId });
  });
  const editIncome = (id: string, label: string, amount: number) => run(() => api.updateExpense(wid, id, { label, amount }));
  const removeIncome = (id: string) => run(() => api.archiveExpense(wid, id));

  // ── people & salaries ──────────────────────────────────────────────────────
  const addPerson = (p: { name: string; color: string; salary: number; hasPanel: boolean }) => run(async () => {
    const s = needScope();
    const person = await api.createPerson(wid, { name: p.name, color: p.color, baseSalary: p.salary, hasPanel: p.hasPanel });
    await api.saveSalary(wid, { personId: person.id, yearId: s.yearId, groupId: s.groupId, amount: p.salary });
  }, 'all');
  const saveSalary = (personId: string, amount: number) => run(() => {
    const s = needScope();
    return api.saveSalary(wid, { personId, yearId: s.yearId, groupId: s.groupId, amount });
  });
  const removePerson = (personId: string) => run(() => {
    const s = needScope();
    return api.removeSalary(wid, { personId, yearId: s.yearId, groupId: s.groupId });
  });

  return {
    // permissions
    canWrite, isAdmin,
    // periods
    years, year, groups, group, scope, showArchived, setShowArchived,
    selectYear: (id: string) => { setYearChoice(id); setGroupChoice(null); },
    selectMonth: setGroupChoice,
    // data
    persons, all, spending, visible, otherIncome, summary, salaries,
    personName: (id?: string | null) => persons.find((p) => p.id === id)?.name,
    salaryOf: (personId: string) => salaries.find((s) => s.personId === personId)?.amount,
    // filters
    filter, setFilter,
    // status
    loading: base.loading, scopeLoading: !!scope && (!fresh || scoped.loading), refreshing: base.refreshing || scoped.refreshing,
    error: base.error || scoped.error, actionError, clearActionError: () => setActionError(''),
    reload: () => { base.reload(); scoped.reload(); },
    // actions
    addYear, renameYear, archiveYear, restoreYear, deleteYear,
    addMonth, renameMonth, archiveMonth, restoreMonth, deleteMonth,
    addExpense, editExpense, archiveExpense, restoreExpense, deleteExpense, toggleStatus,
    addIncome, editIncome, removeIncome,
    addPerson, saveSalary, removePerson,
  };
}

export type ExpensesApi = ReturnType<typeof useExpenses>;
