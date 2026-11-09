// Presentation rules for the expense list (no React): split into sections with counts and totals.
import { toNumber } from '../format';
import type { Expense } from '../types';
import { isPaid } from './logic';

export type StatusGroup = { key: 'pending' | 'paid' | 'archived'; title: string; items: Expense[]; total: number };

// "To pay" first, then "Paid", then "Archived"; sections with nothing in them are left out.
export function groupByStatus(list: Expense[]): StatusGroup[] {
  const buckets: Record<StatusGroup['key'], Expense[]> = { pending: [], paid: [], archived: [] };
  for (const e of list) buckets[e.isArchived ? 'archived' : isPaid(e) ? 'paid' : 'pending'].push(e);
  const titles = { pending: 'To pay', paid: 'Paid', archived: 'Archived' } as const;
  return (['pending', 'paid', 'archived'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, title: titles[key], items: buckets[key], total: buckets[key].reduce((s, e) => s + toNumber(e.amount), 0) }));
}
