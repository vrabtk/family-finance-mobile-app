// Pure numbers for the Analytics screen (no React, no network).
import { toNumber } from '../format';
import type { AnalyticsPeriod } from '../types';

export type Range = '6' | '12' | 'all';
export const RANGES: Array<{ value: Range; label: string }> = [{ value: '6', label: '6 months' }, { value: '12', label: '12 months' }, { value: 'all', label: 'All time' }];

// `periods` come oldest first. A range keeps the most recent ones.
export const windowOf = (periods: AnalyticsPeriod[], range: Range): AnalyticsPeriod[] =>
  range === 'all' ? periods : periods.slice(-Number(range));

const income = (p: AnalyticsPeriod) => toNumber(p.totalIncome);
const spending = (p: AnalyticsPeriod) => toNumber(p.totalExpenses);
const active = (p: AnalyticsPeriod) => income(p) > 0 || spending(p) > 0;

export type Totals = { income: number; spending: number; surplus: number; savingsRate: number | null; avgSpending: number; months: number };

export function totals(periods: AnalyticsPeriod[]): Totals {
  const live = periods.filter(active);
  const inc = live.reduce((s, p) => s + income(p), 0);
  const spent = live.reduce((s, p) => s + spending(p), 0);
  return {
    income: inc,
    spending: spent,
    surplus: inc - spent,
    savingsRate: inc > 0 ? Math.round(((inc - spent) / inc) * 100) : null,
    avgSpending: live.length ? spent / live.length : 0,
    months: live.length,
  };
}

export type YearRow = { label: string; income: number; spending: number; surplus: number };

export function byYear(periods: AnalyticsPeriod[]): YearRow[] {
  const rows = new Map<string, YearRow>();
  for (const p of periods) {
    const row = rows.get(p.yearLabel) ?? { label: p.yearLabel, income: 0, spending: 0, surplus: 0 };
    row.income += income(p);
    row.spending += spending(p);
    row.surplus = row.income - row.spending;
    rows.set(p.yearLabel, row);
  }
  return [...rows.values()];
}

// Highest-spending period and best surplus among periods that had any activity.
export function extremes(periods: AnalyticsPeriod[]): { highestSpend: AnalyticsPeriod | null; bestSurplus: AnalyticsPeriod | null } {
  const live = periods.filter(active);
  if (!live.length) return { highestSpend: null, bestSurplus: null };
  const pick = (score: (p: AnalyticsPeriod) => number) => live.reduce((best, p) => (score(p) > score(best) ? p : best));
  return { highestSpend: pick(spending), bestSurplus: pick((p) => income(p) - spending(p)) };
}

// Bar heights as 0..1 against the largest value on screen, so income and spending share one scale.
export function barHeights(periods: AnalyticsPeriod[]): Array<{ income: number; spending: number }> {
  const max = Math.max(0, ...periods.map((p) => Math.max(income(p), spending(p))));
  return periods.map((p) => ({ income: max ? income(p) / max : 0, spending: max ? spending(p) / max : 0 }));
}

export type Share = { name: string; total: number; share: number };
export function shares(items: Array<{ name: string; total: number }>): Share[] {
  const sum = items.reduce((s, i) => s + toNumber(i.total), 0);
  return items.map((i) => ({ name: i.name, total: toNumber(i.total), share: sum ? toNumber(i.total) / sum : 0 }));
}
