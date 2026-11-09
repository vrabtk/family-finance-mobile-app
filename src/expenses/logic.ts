// Pure rules for the Expenses module (no React, no network): scoping, totals, filters, form parsing.
// These mirror the web app so both clients show the same numbers.
import { toNumber } from '../format';
import type { Expense, ExpenseGroup, ExpenseYear, Person, SalaryEntry } from '../types';

export const OTHER_INCOME = '__other_income__'; // category marker shared with the web app
export const PERSON_COLORS = ['#0F766E', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#16A34A', '#DC2626', '#0891B2'];

// ── Periods ──────────────────────────────────────────────────────────────────
// New id order after moving one item up (-1) or down (+1). Moving past either end changes nothing.
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export const isArchivedPeriod = (p?: { status?: string } | null) => p?.status === 'archived';

export const visibleGroups = (year: ExpenseYear | null | undefined, showArchived: boolean): ExpenseGroup[] =>
  (year?.groups ?? []).filter((g) => showArchived || !isArchivedPeriod(g));

// Scope = the year (flat years) or year + month (monthly years) whose data is on screen.
export type Scope = { yearId: string; groupId: string | null };

export const scopeFor = (year: ExpenseYear | null | undefined, group: ExpenseGroup | null | undefined): Scope | null => {
  if (!year) return null;
  if (year.hasSubgroups) return group ? { yearId: year.id, groupId: group.id } : null; // monthly year needs a month first
  return { yearId: year.id, groupId: null };
};

export const inScope = (e: Expense, scope: Scope | null): boolean =>
  !!scope && e.yearId === scope.yearId && (scope.groupId === null || e.groupId === scope.groupId);

// ── Money ────────────────────────────────────────────────────────────────────
export const pct = (part: number, whole: number): number => (whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0);

export const isSpending = (e: Expense) => e.category !== OTHER_INCOME;
export const isPaid = (e: Expense) => e.status === 'done';

// A person belongs to a period only when they have a salary entry for it.
export const personsInScope = (persons: Person[], salaries: SalaryEntry[]): Person[] =>
  persons.filter((p) => salaries.some((s) => s.personId === p.id));

export type PersonLine = { person: Person; salary: number; spent: number; remaining: number; items: number; paidItems: number; spentPct: number };

export type Summary = {
  salaryTotal: number;
  otherIncomeTotal: number;
  incomeTotal: number;
  spentTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  balance: number; // income - spending
  items: number;
  paidItems: number;
  paidPct: number; // % of spending items paid
  panelPersons: PersonLine[]; // people with their own expense panel
  incomeOnly: Array<{ person: Person; salary: number }>;
  unassigned: { total: number; items: number };
};

export function summarize(persons: Person[], salaries: SalaryEntry[], expenses: Expense[]): Summary {
  const live = expenses.filter((e) => !e.isArchived);
  const spending = live.filter(isSpending);
  const otherIncome = live.filter((e) => !isSpending(e));
  const people = personsInScope(persons, salaries);
  const salaryOf = (id: string) => toNumber(salaries.find((s) => s.personId === id)?.amount);
  const sum = (list: Expense[]) => list.reduce((s, e) => s + toNumber(e.amount), 0);

  const panelPersons = people.filter((p) => p.hasPanel !== false).map((person) => {
    const mine = spending.filter((e) => e.personId === person.id);
    const salary = salaryOf(person.id);
    const spent = sum(mine);
    return { person, salary, spent, remaining: salary - spent, items: mine.length, paidItems: mine.filter(isPaid).length, spentPct: pct(spent, salary) };
  });
  const panelIds = new Set(panelPersons.map((l) => l.person.id));
  const unassignedList = spending.filter((e) => !e.personId || !panelIds.has(e.personId));

  const salaryTotal = people.reduce((s, p) => s + salaryOf(p.id), 0);
  const otherIncomeTotal = sum(otherIncome);
  const spentTotal = sum(spending);
  const paidTotal = sum(spending.filter(isPaid));
  const paidItems = spending.filter(isPaid).length;

  return {
    salaryTotal,
    otherIncomeTotal,
    incomeTotal: salaryTotal + otherIncomeTotal,
    spentTotal,
    paidTotal,
    unpaidTotal: spentTotal - paidTotal,
    balance: salaryTotal + otherIncomeTotal - spentTotal,
    items: spending.length,
    paidItems,
    paidPct: pct(paidItems, spending.length),
    panelPersons,
    incomeOnly: people.filter((p) => p.hasPanel === false).map((person) => ({ person, salary: salaryOf(person.id) })),
    unassigned: { total: sum(unassignedList), items: unassignedList.length },
  };
}

// ── Filtering ────────────────────────────────────────────────────────────────
export type StatusFilter = 'all' | 'pending' | 'done';
export const UNASSIGNED = '__unassigned__';
export type ExpenseFilter = { query: string; status: StatusFilter; personId: string }; // personId '' = everyone

export function filterExpenses(list: Expense[], f: ExpenseFilter, persons: Person[] = []): Expense[] {
  const q = f.query.trim().toLowerCase();
  const nameOf = (id?: string | null) => persons.find((p) => p.id === id)?.name ?? '';
  return list.filter((e) => {
    if (f.status === 'done' && !isPaid(e)) return false;
    if (f.status === 'pending' && isPaid(e)) return false;
    if (f.personId === UNASSIGNED && e.personId) return false;
    if (f.personId && f.personId !== UNASSIGNED && e.personId !== f.personId) return false;
    if (!q) return true;
    return [e.label, e.notes, e.category, nameOf(e.personId)].some((v) => (v ?? '').toLowerCase().includes(q));
  });
}

// ── Form parsing ─────────────────────────────────────────────────────────────
// '' counts as 0 (the web app allows an empty amount); anything else must be a finite number >= 0.
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (t === '') return 0;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 9_999_999_999.99 ? n : null;
}

export type ExpenseForm = { label: string; amount: string; category: string; personId: string; status: string; notes: string };
export const emptyExpenseForm = (): ExpenseForm => ({ label: '', amount: '', category: 'other', personId: '', status: 'pending', notes: '' });

export const formFromExpense = (e: Expense): ExpenseForm => ({
  label: e.label,
  amount: toNumber(e.amount) ? String(toNumber(e.amount)) : '',
  category: e.category && e.category !== OTHER_INCOME ? e.category : 'other',
  personId: e.personId ?? '',
  status: e.status === 'done' ? 'done' : 'pending',
  notes: e.notes ?? '',
});

export type ParsedExpense = { label: string; amount: number; category: string; personId: string | null; status: string; notes: string | null };

export function parseExpenseForm(f: ExpenseForm): { value: ParsedExpense } | { error: string } {
  const label = f.label.trim();
  if (!label) return { error: 'Name is required.' };
  if (label.length > 200) return { error: 'Name must be 200 characters or fewer.' };
  const amount = parseAmount(f.amount);
  if (amount === null) return { error: 'Enter a valid amount (numbers only).' };
  return { value: { label, amount, category: f.category || 'other', personId: f.personId || null, status: f.status === 'done' ? 'done' : 'pending', notes: f.notes.trim() || null } };
}

export const nextIncomeLabel = (existing: number) => `Income source ${existing + 1}`;

// Month names are free text; a year label is usually a number but the API accepts any text.
export const cleanLabel = (text: string): string | null => {
  const t = text.trim();
  return t && t.length <= 200 ? t : null;
};
