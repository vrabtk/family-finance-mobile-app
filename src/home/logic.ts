// Pure rules behind the Home dashboard (no React, no network).
import { daysUntil, toNumber } from '../format';
import { OTHER_INCOME } from '../expenses/logic';
import type { Analytics, AnalyticsPeriod, Bank, Expense } from '../types';

// ── Net worth ────────────────────────────────────────────────────────────────
export const banksTotal = (banks: Bank[]): number =>
  banks.reduce((sum, b) => sum + b.sections.reduce((s, sec) => s + sec.entries.reduce((n, e) => n + toNumber(e.amount), 0), 0), 0);

export type NetWorth = { total: number; banks: number; investments: number; debt: number; assets: number };

// Net worth = money in banks + current value of investments - what is still owed.
export function netWorth(banks: number, investments: number, debt: number): NetWorth {
  const assets = banks + investments;
  return { total: assets - debt, banks, investments, debt, assets };
}

// ── Which month is "now" ─────────────────────────────────────────────────────
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Labels are free text ("Mar-2026", "March", "2026"). Prefer the period named after today's month and year,
// then the latest period that has any activity, then simply the latest one.
// True when the period is named after the calendar month we are in (so "days gone this month" makes sense for it).
export function isCalendarMonth(period: AnalyticsPeriod | null, now: Date = new Date()): boolean {
  if (!period) return false;
  const text = (t: string) => t.toLowerCase();
  const month = MONTHS[now.getMonth()];
  const year = String(now.getFullYear());
  return text(period.label).includes(month) && (text(period.label).includes(year) || text(period.yearLabel).includes(year));
}

export function pickCurrentPeriod(periods: AnalyticsPeriod[], now: Date = new Date()): AnalyticsPeriod | null {
  if (periods.length === 0) return null;
  const month = MONTHS[now.getMonth()];
  const year = String(now.getFullYear());
  const has = (text: string, needle: string) => text.toLowerCase().includes(needle);

  const exact = periods.filter((p) => has(p.label, month) && (has(p.label, year) || has(p.yearLabel, year)));
  if (exact.length) return exact[exact.length - 1];
  const sameMonth = periods.filter((p) => has(p.label, month) && p.groupId !== null);
  if (sameMonth.length) return sameMonth[sameMonth.length - 1];
  const active = periods.filter((p) => toNumber(p.totalIncome) > 0 || toNumber(p.totalExpenses) > 0);
  return (active.length ? active : periods)[(active.length ? active : periods).length - 1];
}

// "Mar-2026" -> "Mar", "March 2026" -> "Mar", "2026" -> "2026"
export const shortLabel = (label: string): string => {
  const first = label.trim().split(/[\s\-/]+/)[0] ?? '';
  return /^\d+$/.test(first) ? first : first.slice(0, 3);
};

// The last `count` periods up to and including `current`, oldest first.
export function trendWindow(periods: AnalyticsPeriod[], current: AnalyticsPeriod | null, count = 6): AnalyticsPeriod[] {
  if (!current) return periods.slice(-count);
  const end = periods.findIndex((p) => p.groupId === current.groupId && p.yearId === current.yearId);
  const upTo = end >= 0 ? periods.slice(0, end + 1) : periods;
  return upTo.slice(-count);
}

// ── This month ───────────────────────────────────────────────────────────────
export type MonthStatus = 'good' | 'watch' | 'over' | 'empty';

export function monthStatus(income: number, spent: number): MonthStatus {
  if (income <= 0 && spent <= 0) return 'empty';
  if (spent > income) return 'over';
  return income > 0 && spent / income > 0.8 ? 'watch' : 'good';
}

// 0..1 share of income already spent (capped so the ring never overflows).
export const spentShare = (income: number, spent: number): number => (income > 0 ? Math.min(1, Math.max(0, spent / income)) : spent > 0 ? 1 : 0);

export type CategorySlice = { name: string; total: number; share: number };

const live = (e: Expense) => !e.isArchived && e.category !== OTHER_INCOME;

// Biggest categories first; everything past `max` is folded into "Other".
export function categoryBreakdown(expenses: Expense[], max = 5): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const e of expenses.filter(live)) {
    const name = e.category && e.category.trim() ? e.category : 'other';
    totals.set(name, (totals.get(name) ?? 0) + toNumber(e.amount));
  }
  const sorted = [...totals.entries()].map(([name, total]) => ({ name, total })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const grand = sorted.reduce((s, c) => s + c.total, 0);
  if (grand === 0) return [];
  let top = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((s, c) => s + c.total, 0);
  if (rest > 0) {
    const other = top.find((c) => c.name === 'other');
    if (other) other.total += rest; else top = [...top, { name: 'other', total: rest }];
  }
  return top.map((c) => ({ ...c, share: c.total / grand }));
}

export const unpaidBills = (expenses: Expense[]): Expense[] =>
  expenses.filter((e) => live(e) && e.status !== 'done' && toNumber(e.amount) > 0).sort((a, b) => toNumber(b.amount) - toNumber(a.amount));

// ── Needs attention ──────────────────────────────────────────────────────────
export type Attention = {
  id: string;
  kind: 'bill' | 'insurance';
  tone: 'warning' | 'negative' | 'info';
  title: string;
  detail: string;
  amount?: number;
};

type PolicyLike = { id: string; name: string; premiumAmount?: unknown; nextDueDate?: string | null; isArchived?: boolean };

export function attentionItems(bills: Expense[], policies: PolicyLike[], now: Date = new Date(), maxBills = 3): Attention[] {
  const items: Attention[] = [];
  for (const p of policies) {
    if (p.isArchived) continue;
    const days = daysUntil(p.nextDueDate, now);
    if (days === null || days > 30) continue;
    items.push({
      id: `ins-${p.id}`, kind: 'insurance', tone: days < 0 ? 'negative' : 'warning', title: `${p.name} premium`,
      detail: days < 0 ? `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}` : days === 0 ? 'Due today' : `Due in ${days} ${days === 1 ? 'day' : 'days'}`,
      amount: toNumber(p.premiumAmount),
    });
  }
  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'negative' ? -1 : 1));
  const shown = bills.slice(0, maxBills).map<Attention>((e) => ({ id: `bill-${e.id}`, kind: 'bill', tone: 'info', title: e.label, detail: 'Unpaid this month', amount: toNumber(e.amount) }));
  return [...items, ...shown];
}

// ── Greeting ─────────────────────────────────────────────────────────────────
export const greeting = (now: Date = new Date()): string => {
  const h = now.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
};

export const gainPercent = (a: Pick<Analytics, 'totalInvested' | 'investmentGain'>): number | null =>
  toNumber(a.totalInvested) > 0 ? (toNumber(a.investmentGain) / toNumber(a.totalInvested)) * 100 : null;
