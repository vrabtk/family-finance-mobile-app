import { DEFAULT_LAYOUT, HOME_SECTIONS, cleanLayout, moveSection, toggleSection, visibleSections } from '../layout';
import { InsightInput, buildInsights } from '../insights';
import { setupComplete, setupProgress, setupSteps } from '../setup';

const base = (over: Partial<InsightInput> = {}): InsightInput => ({
  hasMonth: true, thisMonth: true, income: 100000, spent: 50000, unpaidCount: 0, unpaidTotal: 0, prevSpent: null,
  monthlyEmi: 0, topCategory: null, dues: [], now: new Date(2026, 10, 30), // last day of November: pace never trips
  ...over,
});
const ids = (i: InsightInput, max?: number) => buildInsights(i, max).map((x) => x.id);

describe('insights', () => {
  test('overspending comes first and carries the amount', () => {
    const out = buildInsights(base({ income: 50000, spent: 62000, unpaidCount: 2, unpaidTotal: 900 }));
    expect(out[0].id).toBe('overspent');
    expect(out[0].tone).toBe('negative');
    expect(out[0].detail).toContain('12,000');
  });

  test('an overdue premium outranks a premium due soon, and both outrank info', () => {
    expect(ids(base({ dues: [{ name: 'Health', days: -3 }, { name: 'Term', days: 2 }], unpaidCount: 1, unpaidTotal: 10 }))).toEqual(['premium-overdue', 'premium-soon', 'unpaid']);
  });

  test('pace warns only for the calendar month, only when spending runs well ahead of the days gone', () => {
    const early = new Date(2026, 10, 6); // 20% of the month
    expect(ids(base({ now: early, spent: 60000 }))).toContain('pace');
    expect(ids(base({ now: early, spent: 60000, thisMonth: false }))).not.toContain('pace');
    expect(ids(base({ now: early, spent: 20000 }))).not.toContain('pace');
    expect(ids(base({ now: new Date(2026, 10, 15), spent: 60000 }))).not.toContain('pace'); // 50% gone, 60% spent: within margin
  });

  test('EMI load above 40% of income is flagged, at or below is not', () => {
    expect(ids(base({ monthlyEmi: 45000 }))).toContain('emi-load');
    expect(ids(base({ monthlyEmi: 40000 }))).not.toContain('emi-load');
    expect(ids(base({ income: 0, spent: 0, monthlyEmi: 5000 }))).not.toContain('emi-load');
  });

  test('unpaid bills are counted in plain words', () => {
    expect(buildInsights(base({ unpaidCount: 1, unpaidTotal: 14100 })).find((x) => x.id === 'unpaid')?.title).toBe('1 bill still to pay');
    expect(buildInsights(base({ unpaidCount: 3, unpaidTotal: 100 })).find((x) => x.id === 'unpaid')?.title).toBe('3 bills still to pay');
  });

  test('spending change against the month before: up 20%+ warns, down 15%+ praises, in between is silent', () => {
    expect(ids(base({ spent: 60000, prevSpent: 50000 }))).toContain('spend-up');
    expect(ids(base({ spent: 40000, prevSpent: 50000 }))).toContain('spend-down');
    expect(ids(base({ spent: 54000, prevSpent: 50000 }))).not.toContain('spend-up');
    expect(ids(base({ spent: 50000, prevSpent: 0 }))).not.toContain('spend-up');
    expect(ids(base({ spent: 50000, prevSpent: null }))).not.toContain('spend-up');
  });

  test('a dominant category and a good savings rate are noticed', () => {
    expect(buildInsights(base({ topCategory: { name: 'rent', share: 0.62 } })).find((x) => x.id === 'top-category')?.title).toBe('Rent is 62% of spending');
    expect(ids(base({ topCategory: { name: 'rent', share: 0.4 } }))).not.toContain('top-category');
    expect(buildInsights(base({ spent: 40000 })).find((x) => x.id === 'saving')?.title).toBe('You are saving 60% of income');
    expect(ids(base({ spent: 80000 }))).not.toContain('saving');
  });

  test('at most the requested number are returned, worst first', () => {
    const many = base({ income: 50000, spent: 62000, unpaidCount: 2, unpaidTotal: 5, dues: [{ name: 'Health', days: -1 }], monthlyEmi: 30000 });
    expect(ids(many)).toEqual(['overspent', 'premium-overdue', 'emi-load']);
    expect(ids(many, 1)).toEqual(['overspent']);
  });

  test('a quiet month says all clear; no month yet asks for numbers', () => {
    expect(ids(base({ income: 100000, spent: 90000, now: new Date(2026, 10, 30) }))).toEqual(['calm']);
    const none = buildInsights(base({ hasMonth: false, income: 0, spent: 0 }));
    expect(none.map((x) => x.id)).toEqual(['start']);
    expect(none[0].action?.to).toBe('expenses');
  });
});

describe('dashboard layout', () => {
  test('the default shows every section in a fixed order', () => {
    expect(visibleSections(DEFAULT_LAYOUT)).toEqual(HOME_SECTIONS.map((s) => s.id));
  });

  test('cleanLayout keeps a valid saved layout and fills in what is missing', () => {
    const out = cleanLayout({ order: ['tiles', 'worth'], hidden: ['trend'] });
    expect(out.order.slice(0, 2)).toEqual(['tiles', 'worth']);
    expect(out.order).toHaveLength(HOME_SECTIONS.length);
    expect(new Set(out.order).size).toBe(HOME_SECTIONS.length);
    expect(out.hidden).toEqual(['trend']);
  });

  test('cleanLayout survives garbage', () => {
    for (const raw of [undefined, null, 'x', 5, [], { order: 'no', hidden: 7 }, { order: ['bogus', 'worth', 'worth'], hidden: ['bogus', 'trend', 'trend'] }]) {
      const out = cleanLayout(raw);
      expect(out.order).toHaveLength(HOME_SECTIONS.length);
      expect(new Set(out.order).size).toBe(HOME_SECTIONS.length);
      expect(out.hidden.every((h) => out.order.includes(h))).toBe(true);
    }
    expect(cleanLayout({ order: ['bogus', 'worth', 'worth'], hidden: ['bogus', 'trend', 'trend'] })).toMatchObject({ order: expect.arrayContaining(['worth']), hidden: ['trend'] });
  });

  test('hide, show and move', () => {
    const hidden = toggleSection(DEFAULT_LAYOUT, 'trend');
    expect(visibleSections(hidden)).not.toContain('trend');
    expect(visibleSections(toggleSection(hidden, 'trend'))).toContain('trend');
    const moved = moveSection(DEFAULT_LAYOUT, 'tiles', -1);
    expect(moved.order.indexOf('tiles')).toBe(DEFAULT_LAYOUT.order.indexOf('tiles') - 1);
    expect(moveSection(DEFAULT_LAYOUT, 'insights', -1)).toEqual(DEFAULT_LAYOUT);
    expect(DEFAULT_LAYOUT.hidden).toEqual([]); // never mutated
  });
});

describe('getting started checklist', () => {
  const empty = { all: null, banks: null, policies: null, periods: [], expenses: null } as any;
  const full = {
    all: { expenseCount: 4, totalDebt: 1000, totalInvested: 0 }, banks: [{ id: 'b' }], policies: [{ id: 'p' }],
    periods: [{ totalIncome: 5000 }], expenses: [{ id: 'e' }],
  } as any;

  test('nothing is done on an empty household', () => {
    const steps = setupSteps(empty);
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
    expect(setupProgress(steps)).toEqual({ done: 0, total: 6 });
    expect(setupComplete(steps)).toBe(false);
  });

  test('steps tick from real data and the list completes', () => {
    const steps = setupSteps(full);
    expect(setupComplete(steps)).toBe(true);
    expect(setupProgress(steps).done).toBe(6);
  });

  test('a month without income leaves the salary step open; investments also count as the loan-or-investment step', () => {
    const steps = setupSteps({ ...full, periods: [{ totalIncome: 0 }], all: { expenseCount: 0, totalDebt: 0, totalInvested: 500 } });
    expect(steps.find((s) => s.id === 'income')?.done).toBe(false);
    expect(steps.find((s) => s.id === 'month')?.done).toBe(true);
    expect(steps.find((s) => s.id === 'debt')?.done).toBe(true);
  });

  test('every step opens a real screen', () => {
    for (const s of setupSteps(empty)) expect(['expenses', 'banks', 'loans', 'more']).toContain(s.route.tab);
  });
});
