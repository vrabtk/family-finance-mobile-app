import type { AnalyticsPeriod, Bank, Expense } from '../../types';
import {
  attentionItems, banksTotal, categoryBreakdown, gainPercent, greeting, monthStatus, netWorth, pickCurrentPeriod, shortLabel, spentShare, trendWindow, unpaidBills,
} from '../logic';

const period = (label: string, income = 0, spent = 0, over: Partial<AnalyticsPeriod> = {}): AnalyticsPeriod => ({
  yearId: 'y1', yearLabel: '2026', groupId: `g-${label}`, label, totalIncome: income, totalExpenses: spent, surplus: income - spent, ...over,
});
const exp = (id: string, over: Partial<Expense> = {}): Expense => ({ id, label: id, amount: 100, status: 'pending', category: 'food', isArchived: false, ...over });
const at = (iso: string) => new Date(iso);

describe('netWorth and banksTotal', () => {
  test('assets minus debt', () => {
    expect(netWorth(500000, 700000, 200000)).toEqual({ total: 1000000, banks: 500000, investments: 700000, debt: 200000, assets: 1200000 });
  });
  test('can be negative', () => expect(netWorth(1000, 0, 5000).total).toBe(-4000));
  test('banksTotal sums every entry of every section, treating string decimals and bad values safely', () => {
    const banks: Bank[] = [
      { id: 'b1', name: 'A', sections: [{ id: 's1', name: 'x', entries: [{ id: 'e1', label: '', amount: '1000.50' }, { id: 'e2', label: '', amount: 500 }] }, { id: 's2', name: 'y', entries: [] }] },
      { id: 'b2', name: 'B', sections: [{ id: 's3', name: 'z', entries: [{ id: 'e3', label: '', amount: 'oops' }, { id: 'e4', label: '', amount: '2' }] }] },
    ];
    expect(banksTotal(banks)).toBe(1502.5);
    expect(banksTotal([])).toBe(0);
  });
});

describe('pickCurrentPeriod', () => {
  const periods = [period('Jan-2026', 100, 50), period('Feb-2026', 100, 50), period('Mar-2026', 100, 50), period('Apr-2026')];

  test('empty list gives null', () => expect(pickCurrentPeriod([], at('2026-03-10'))).toBeNull());
  test('prefers the period named after the current month and year', () => {
    expect(pickCurrentPeriod(periods, at('2026-02-20'))?.label).toBe('Feb-2026');
    expect(pickCurrentPeriod(periods, at('2026-03-01T10:00:00'))?.label).toBe('Mar-2026');
  });
  test('matches full month names and a year held on the year label', () => {
    const named = [period('January', 1, 1, { yearLabel: '2026' }), period('March', 1, 1, { yearLabel: '2026' }), period('March', 1, 1, { yearLabel: '2025', yearId: 'y0', groupId: 'g-old' })];
    expect(pickCurrentPeriod(named, at('2026-03-15'))?.yearLabel).toBe('2026');
  });
  test('same month from another year beats nothing', () => {
    expect(pickCurrentPeriod([period('Mar-2025', 5, 5), period('Apr-2025', 5, 5)], at('2026-03-15'))?.label).toBe('Mar-2025');
  });
  test('no name match: the latest period with activity', () => {
    expect(pickCurrentPeriod(periods, at('2026-09-01'))?.label).toBe('Mar-2026'); // Apr has no data
  });
  test('nothing active: simply the last period', () => {
    expect(pickCurrentPeriod([period('A'), period('B')], at('2026-09-01'))?.label).toBe('B');
  });
  test('a flat year (no month) is matched by activity', () => {
    const flat = [period('2025', 10, 5, { groupId: null, yearLabel: '2025' }), period('2026', 20, 5, { groupId: null, yearLabel: '2026', yearId: 'y2' })];
    expect(pickCurrentPeriod(flat, at('2026-09-01'))?.label).toBe('2026');
  });
});

describe('shortLabel', () => {
  test.each([['Mar-2026', 'Mar'], ['March 2026', 'Mar'], ['  April  ', 'Apr'], ['2026', '2026'], ['FY27', 'FY2'], ['', '']])('%j -> %j', (input, out) => expect(shortLabel(input)).toBe(out));
});

describe('trendWindow', () => {
  const ps = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((l) => period(l, 1, 1));
  test('last N periods up to and including the current one', () => {
    expect(trendWindow(ps, ps[6], 3).map((p) => p.label)).toEqual(['E', 'F', 'G']);
    expect(trendWindow(ps, ps[1], 6).map((p) => p.label)).toEqual(['A', 'B']);
  });
  test('without a current period it shows the latest N', () => expect(trendWindow(ps, null, 2).map((p) => p.label)).toEqual(['G', 'H']));
  test('a current period not in the list falls back to everything', () => expect(trendWindow(ps, period('Z', 1, 1, { yearId: 'nope' }), 3).map((p) => p.label)).toEqual(['F', 'G', 'H']));
});

describe('month status and spent share', () => {
  test.each([[0, 0, 'empty'], [1000, 500, 'good'], [1000, 800, 'good'], [1000, 801, 'watch'], [1000, 1000, 'watch'], [1000, 1001, 'over'], [0, 50, 'over']])('income %s spent %s -> %s', (i, s, out) => {
    expect(monthStatus(i, s)).toBe(out);
  });
  test('spentShare is capped to 0..1 and handles zero income', () => {
    expect(spentShare(1000, 250)).toBe(0.25);
    expect(spentShare(1000, 5000)).toBe(1);
    expect(spentShare(0, 100)).toBe(1);
    expect(spentShare(0, 0)).toBe(0);
    expect(spentShare(1000, -5)).toBe(0);
  });
});

describe('categoryBreakdown', () => {
  test('groups, sorts and computes shares; ignores archived and other income', () => {
    const list = [
      exp('a', { category: 'food', amount: 300 }), exp('b', { category: 'food', amount: 100 }), exp('c', { category: 'housing', amount: 600 }),
      exp('d', { category: '__other_income__', amount: 9999 }), exp('e', { category: 'food', amount: 5000, isArchived: true }),
    ];
    expect(categoryBreakdown(list)).toEqual([{ name: 'housing', total: 600, share: 0.6 }, { name: 'food', total: 400, share: 0.4 }]);
  });
  test('missing categories count as other; zero amounts are dropped', () => {
    const out = categoryBreakdown([exp('a', { category: null, amount: 10 }), exp('b', { category: '  ', amount: 10 }), exp('c', { category: 'food', amount: 0 })]);
    expect(out).toEqual([{ name: 'other', total: 20, share: 1 }]);
  });
  test('more than max categories: the tail is folded into other, and shares add up to 1', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const list = names.map((n, i) => exp(n, { category: n, amount: 100 - i * 10 }));
    const out = categoryBreakdown(list, 3);
    expect(out.map((c) => c.name)).toEqual(['a', 'b', 'c', 'other']);
    expect(out[3].total).toBe(70 + 60 + 50 + 40);
    expect(out.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
  });
  test('the tail merges into an existing "other" instead of duplicating it', () => {
    const list = [exp('a', { category: 'other', amount: 90 }), exp('b', { category: 'x', amount: 80 }), exp('c', { category: 'y', amount: 10 })];
    const out = categoryBreakdown(list, 2);
    expect(out.map((c) => c.name)).toEqual(['other', 'x']);
    expect(out.find((c) => c.name === 'other')!.total).toBe(100);
  });
  test('no spending gives an empty list', () => expect(categoryBreakdown([])).toEqual([]));
});

describe('unpaidBills', () => {
  test('pending, non-archived, non-income, positive amounts, biggest first', () => {
    const list = [
      exp('small', { amount: 10 }), exp('big', { amount: 900 }), exp('paid', { status: 'done', amount: 5000 }), exp('old', { isArchived: true, amount: 700 }),
      exp('inc', { category: '__other_income__', amount: 800 }), exp('zero', { amount: 0 }), exp('mid', { amount: '250.5' }),
    ];
    expect(unpaidBills(list).map((e) => e.id)).toEqual(['big', 'mid', 'small']);
  });
});

describe('attentionItems', () => {
  const now = at('2026-03-10T12:00:00Z');
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
  const pol = (id: string, days: number | null, extra = {}) => ({ id, name: `Policy ${id}`, premiumAmount: '1200', nextDueDate: days === null ? null : day(days), ...extra });

  test('insurance due within 30 days or overdue; far-off, undated and archived are skipped', () => {
    const items = attentionItems([], [pol('a', 5), pol('b', 31), pol('c', null), pol('d', -3), pol('e', 2, { isArchived: true }), pol('f', 30)], now);
    expect(items.map((i) => i.id)).toEqual(['ins-d', 'ins-a', 'ins-f']); // overdue first
    expect(items[0]).toMatchObject({ tone: 'negative', detail: 'Overdue by 3 days', amount: 1200 });
    expect(items[1]).toMatchObject({ tone: 'warning', detail: 'Due in 5 days' });
  });
  test('singular wording and due today', () => {
    const items = attentionItems([], [pol('a', 1), pol('b', -1)], now);
    expect(items.map((i) => i.detail).sort()).toEqual(['Due in 1 day', 'Overdue by 1 day']);
    expect(attentionItems([], [{ id: 'x', name: 'X', nextDueDate: now.toISOString() }], now)[0].detail).toBe('Due today');
  });
  test('unpaid bills are listed after insurance and capped', () => {
    const bills = ['a', 'b', 'c', 'd', 'e'].map((id, i) => exp(id, { amount: 500 - i }));
    const items = attentionItems(bills, [pol('p', 4)], now, 3);
    expect(items.map((i) => i.id)).toEqual(['ins-p', 'bill-a', 'bill-b', 'bill-c']);
    expect(items[1]).toMatchObject({ kind: 'bill', amount: 500, detail: 'Unpaid this month' });
  });
  test('nothing to flag gives an empty list', () => expect(attentionItems([], [], now)).toEqual([]));
});

describe('greeting and gainPercent', () => {
  test.each([['2026-03-10T03:00:00', 'Good night'], ['2026-03-10T08:00:00', 'Good morning'], ['2026-03-10T14:00:00', 'Good afternoon'], ['2026-03-10T19:00:00', 'Good evening'], ['2026-03-10T23:30:00', 'Good night']])('%s -> %s', (iso, out) => {
    expect(greeting(at(iso))).toBe(out);
  });
  test('gainPercent', () => {
    expect(gainPercent({ totalInvested: 200, investmentGain: 50 })).toBe(25);
    expect(gainPercent({ totalInvested: 200, investmentGain: -50 })).toBe(-25);
    expect(gainPercent({ totalInvested: 0, investmentGain: 10 })).toBeNull();
  });
});
