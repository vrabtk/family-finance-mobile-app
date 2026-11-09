import type { Expense } from '../../types';
import { groupByStatus } from '../view';

const e = (id: string, amount: number, over: Partial<Expense> = {}): Expense => ({ id, label: id, amount, status: 'pending', ...over } as Expense);

test('splits into To pay, Paid and Archived with counts and totals, keeping order', () => {
  const out = groupByStatus([e('a', 100), e('b', 50, { status: 'done' }), e('c', '25' as any), e('d', 10, { isArchived: true, status: 'done' })]);
  expect(out.map((g) => [g.title, g.items.map((x) => x.id), g.total])).toEqual([
    ['To pay', ['a', 'c'], 125], ['Paid', ['b'], 50], ['Archived', ['d'], 10],
  ]);
});

test('empty sections are left out, and nothing gives nothing', () => {
  expect(groupByStatus([e('a', 1, { status: 'done' })]).map((g) => g.key)).toEqual(['paid']);
  expect(groupByStatus([])).toEqual([]);
});
