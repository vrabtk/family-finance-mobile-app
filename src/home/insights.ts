// The "smart highlights" on Home: a few short, prioritised messages worked out from the numbers on screen.
// Pure (no React, no network); every rule has a threshold that is easy to read here and to test.
import { inr } from '../format';
import type { IconName } from '../ui';

export type InsightTone = 'positive' | 'warning' | 'negative' | 'info';
export type InsightTarget = 'expenses' | 'insurance' | 'loans' | 'analytics';

export type Insight = {
  id: string;
  tone: InsightTone;
  icon: IconName;
  title: string;
  detail: string;
  action?: { label: string; to: InsightTarget };
};

export type InsightInput = {
  hasMonth: boolean;       // there is a current month to talk about
  thisMonth: boolean;      // that month is the calendar month we are in (so "pace" makes sense)
  income: number;
  spent: number;
  unpaidCount: number;
  unpaidTotal: number;
  prevSpent: number | null; // spending of the month before, when known
  monthlyEmi: number;
  topCategory: { name: string; share: number } | null;
  dues: Array<{ name: string; days: number }>; // insurance premiums: days until due (negative = overdue)
  now: Date;
};

const pct = (n: number) => Math.round(n * 100);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Lower rank = shown first. Problems before information before good news.
type Ranked = Insight & { rank: number };

export function buildInsights(i: InsightInput, max = 3): Insight[] {
  const out: Ranked[] = [];
  const add = (rank: number, insight: Insight) => out.push({ ...insight, rank });
  const overspent = i.income > 0 && i.spent > i.income;

  if (overspent) {
    add(1, { id: 'overspent', tone: 'negative', icon: 'alert-triangle', title: 'Spending is above income',
      detail: `You are ${inr(i.spent - i.income)} over this month.`, action: { label: 'See expenses', to: 'expenses' } });
  }

  const overdue = i.dues.filter((d) => d.days < 0).sort((a, b) => a.days - b.days)[0];
  if (overdue) {
    add(2, { id: 'premium-overdue', tone: 'negative', icon: 'shield', title: `${overdue.name} premium is overdue`,
      detail: `Overdue by ${plural(-overdue.days, 'day', 'days')}.`, action: { label: 'Open insurance', to: 'insurance' } });
  }

  if (i.hasMonth && i.thisMonth && !overspent && i.income > 0 && i.spent > 0) {
    const month = i.now.getDate() / daysInMonth(i.now);
    const used = i.spent / i.income;
    if (used > month + 0.25) {
      add(3, { id: 'pace', tone: 'warning', icon: 'clock', title: 'Spending is ahead of the month',
        detail: `${pct(used)}% of income spent with ${pct(month)}% of the month gone.`, action: { label: 'See expenses', to: 'expenses' } });
    }
  }

  const soon = i.dues.filter((d) => d.days >= 0 && d.days <= 7).sort((a, b) => a.days - b.days)[0];
  if (soon) {
    add(4, { id: 'premium-soon', tone: 'warning', icon: 'shield', title: `${soon.name} premium is due ${soon.days === 0 ? 'today' : `in ${plural(soon.days, 'day', 'days')}`}`,
      detail: 'Keep the money ready so cover does not lapse.', action: { label: 'Open insurance', to: 'insurance' } });
  }

  if (i.income > 0 && i.monthlyEmi / i.income > 0.4) {
    add(5, { id: 'emi-load', tone: 'warning', icon: 'percent', title: `EMIs take ${pct(i.monthlyEmi / i.income)}% of your income`,
      detail: 'Above 40% leaves little room for savings.', action: { label: 'See loans', to: 'loans' } });
  }

  if (i.unpaidCount > 0) {
    add(6, { id: 'unpaid', tone: 'info', icon: 'file-text', title: `${plural(i.unpaidCount, 'bill', 'bills')} still to pay`,
      detail: `${inr(i.unpaidTotal)} unpaid this month.`, action: { label: 'Open bills', to: 'expenses' } });
  }

  if (i.prevSpent !== null && i.prevSpent > 0 && i.spent > 0) {
    const change = (i.spent - i.prevSpent) / i.prevSpent;
    if (change >= 0.2) {
      add(7, { id: 'spend-up', tone: 'warning', icon: 'trending-up', title: `Spending is up ${pct(change)}%`,
        detail: `${inr(i.spent)} against ${inr(i.prevSpent)} the month before.`, action: { label: 'See analytics', to: 'analytics' } });
    } else if (change <= -0.15) {
      add(8, { id: 'spend-down', tone: 'positive', icon: 'trending-down', title: `Spending is down ${pct(-change)}%`,
        detail: `${inr(i.spent)} against ${inr(i.prevSpent)} the month before. Nicely done.` });
    }
  }

  if (i.topCategory && i.topCategory.share >= 0.5 && i.spent > 0) {
    add(9, { id: 'top-category', tone: 'info', icon: 'pie-chart', title: `${cap(i.topCategory.name)} is ${pct(i.topCategory.share)}% of spending`,
      detail: 'One category dominates this month.', action: { label: 'See analytics', to: 'analytics' } });
  }

  if (i.income > 0 && i.spent > 0 && !overspent && i.spent / i.income <= 0.6) {
    add(10, { id: 'saving', tone: 'positive', icon: 'smile', title: `You are saving ${pct(1 - i.spent / i.income)}% of income`,
      detail: 'A healthy month. Keep it up.' });
  }

  if (out.length === 0) {
    out.push(i.hasMonth
      ? { rank: 99, id: 'calm', tone: 'positive', icon: 'check-circle', title: 'All clear', detail: 'Nothing needs your attention right now.' }
      : { rank: 99, id: 'start', tone: 'info', icon: 'edit-3', title: 'Add this month\'s numbers', detail: 'Add a month with salaries and expenses to unlock highlights.', action: { label: 'Open expenses', to: 'expenses' } });
  }

  return out.sort((a, b) => a.rank - b.rank).slice(0, max).map(({ rank: _rank, ...insight }) => insight);
}
