import type { AnalyticsPeriod } from '../../types';
import { barHeights, byYear, extremes, shares, totals, windowOf } from '../logic';

const p = (label: string, inc: number, exp: number, yearLabel = '2026'): AnalyticsPeriod =>
  ({ yearId: 'y', yearLabel, groupId: label, label, totalIncome: inc, totalExpenses: exp, surplus: inc - exp });
const data = [p('Jan', 1000, 400), p('Feb', 1000, 1200), p('Mar', 0, 0), p('Apr', '2000' as any, '500' as any, '2027')];

test('windowOf keeps the most recent periods', () => {
  expect(windowOf(data, '6')).toHaveLength(4);
  expect(windowOf(data, '12')).toHaveLength(4);
  expect(windowOf(data, 'all')).toHaveLength(4);
  expect(windowOf([...data, ...data, ...data], '6').map((x) => x.label)).toEqual(['Mar', 'Apr', 'Jan', 'Feb', 'Mar', 'Apr']);
});

test('totals count only periods with activity; amounts may arrive as strings', () => {
  expect(totals(data)).toEqual({ income: 4000, spending: 2100, surplus: 1900, savingsRate: 48, avgSpending: 700, months: 3 });
});

test('totals of nothing are zero with no savings rate', () => {
  expect(totals([])).toEqual({ income: 0, spending: 0, surplus: 0, savingsRate: null, avgSpending: 0, months: 0 });
  expect(totals([p('x', 0, 50)]).savingsRate).toBeNull();
});

test('byYear groups in order and sums', () => {
  expect(byYear(data)).toEqual([
    { label: '2026', income: 2000, spending: 1600, surplus: 400 },
    { label: '2027', income: 2000, spending: 500, surplus: 1500 },
  ]);
});

test('extremes ignore empty periods', () => {
  const e = extremes(data);
  expect(e.highestSpend?.label).toBe('Feb');
  expect(e.bestSurplus?.label).toBe('Apr');
  expect(extremes([p('Mar', 0, 0)])).toEqual({ highestSpend: null, bestSurplus: null });
});

test('barHeights share one scale', () => {
  expect(barHeights([p('a', 100, 50), p('b', 200, 200)])).toEqual([{ income: 0.5, spending: 0.25 }, { income: 1, spending: 1 }]);
  expect(barHeights([p('a', 0, 0)])).toEqual([{ income: 0, spending: 0 }]);
});

test('shares add up to 1', () => {
  const out = shares([{ name: 'a', total: 30 }, { name: 'b', total: 10 }]);
  expect(out.map((s) => s.share)).toEqual([0.75, 0.25]);
  expect(shares([])).toEqual([]);
});
