import type { Expense, ExpenseGroup, ExpenseYear, Person, SalaryEntry } from '../../types';
import {
  ExpenseFilter, OTHER_INCOME, UNASSIGNED, cleanLabel, emptyExpenseForm, filterExpenses, formFromExpense, inScope, isArchivedPeriod, nextIncomeLabel,
  moveId, parseAmount, parseExpenseForm, pct, personsInScope, scopeFor, summarize, visibleGroups,
} from '../logic';

// ── fixtures ─────────────────────────────────────────────────────────────────
const hari: Person = { id: 'p1', name: 'Hari', hasPanel: true };
const hema: Person = { id: 'p2', name: 'Hema', hasPanel: true };
const side: Person = { id: 'p3', name: 'Side', hasPanel: false };
const ghost: Person = { id: 'p4', name: 'Ghost', hasPanel: true }; // no salary entry in scope

const salary = (personId: string, amount: number | string): SalaryEntry => ({ id: `s-${personId}`, personId, amount, yearId: 'y1', groupId: 'g1' });
const exp = (id: string, over: Partial<Expense> = {}): Expense => ({ id, label: id, amount: 100, status: 'pending', yearId: 'y1', groupId: 'g1', personId: null, category: 'other', ...over });

describe('periods', () => {
  const march: ExpenseGroup = { id: 'g1', label: 'Mar', status: 'active' };
  const april: ExpenseGroup = { id: 'g2', label: 'Apr', status: 'archived' };
  const monthly: ExpenseYear = { id: 'y1', label: '2026', hasSubgroups: true, groups: [march, april] };
  const flat: ExpenseYear = { id: 'y2', label: '2025', hasSubgroups: false };

  test('isArchivedPeriod only matches archived status', () => {
    expect(isArchivedPeriod(april)).toBe(true);
    expect(isArchivedPeriod(march)).toBe(false);
    expect(isArchivedPeriod(null)).toBe(false);
    expect(isArchivedPeriod({})).toBe(false);
  });

  test('visibleGroups hides archived months unless asked', () => {
    expect(visibleGroups(monthly, false).map((g) => g.id)).toEqual(['g1']);
    expect(visibleGroups(monthly, true).map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(visibleGroups(flat, true)).toEqual([]);
    expect(visibleGroups(null, true)).toEqual([]);
  });

  test('scopeFor: monthly year needs a month, flat year does not, no year means no scope', () => {
    expect(scopeFor(monthly, march)).toEqual({ yearId: 'y1', groupId: 'g1' });
    expect(scopeFor(monthly, null)).toBeNull();
    expect(scopeFor(flat, null)).toEqual({ yearId: 'y2', groupId: null });
    expect(scopeFor(null, null)).toBeNull();
  });

  test('inScope matches the year and, for monthly years, the month', () => {
    const scope = { yearId: 'y1', groupId: 'g1' };
    expect(inScope(exp('a'), scope)).toBe(true);
    expect(inScope(exp('b', { groupId: 'g2' }), scope)).toBe(false);
    expect(inScope(exp('c', { yearId: 'y9' }), scope)).toBe(false);
    expect(inScope(exp('d', { yearId: 'y2', groupId: null }), { yearId: 'y2', groupId: null })).toBe(true);
    expect(inScope(exp('e'), null)).toBe(false);
  });
});

describe('moveId', () => {
  test('moves one step up or down', () => {
    expect(moveId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });
  test('does nothing past either end or for an unknown id, and never changes the input', () => {
    const ids = ['a', 'b'];
    expect(moveId(ids, 'a', -1)).toEqual(['a', 'b']);
    expect(moveId(ids, 'b', 1)).toEqual(['a', 'b']);
    expect(moveId(ids, 'z', 1)).toEqual(['a', 'b']);
    expect(moveId(ids, 'b', -1)).toEqual(['b', 'a']);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('pct', () => {
  test.each([[50, 200, 25], [1, 3, 33], [2, 3, 67], [0, 100, 0], [300, 200, 100], [-5, 100, 0], [10, 0, 0], [10, -4, 0]])('pct(%s, %s) = %s', (a, b, out) => {
    expect(pct(a, b)).toBe(out);
  });
});

describe('personsInScope', () => {
  test('only people with a salary entry belong to the period', () => {
    expect(personsInScope([hari, hema, ghost], [salary('p1', 1), salary('p2', 2)]).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(personsInScope([hari], [])).toEqual([]);
  });
});

describe('summarize', () => {
  const salaries = [salary('p1', 50000), salary('p2', '30000.50'), salary('p3', 5000)];
  const persons = [hari, hema, side, ghost];

  test('empty period gives all zeros and no division errors', () => {
    const s = summarize([], [], []);
    expect(s).toMatchObject({ incomeTotal: 0, spentTotal: 0, balance: 0, items: 0, paidItems: 0, paidPct: 0, unpaidTotal: 0 });
    expect(s.panelPersons).toEqual([]);
    expect(s.unassigned).toEqual({ total: 0, items: 0 });
  });

  test('income = salaries of people in scope + other income; balance = income - spending', () => {
    const expenses = [
      exp('rent', { amount: '25000', personId: 'p1', status: 'done' }),
      exp('food', { amount: 9800.5, personId: 'p2' }),
      exp('rent-in', { amount: 12000, category: OTHER_INCOME, status: 'done' }),
    ];
    const s = summarize(persons, salaries, expenses);
    expect(s.salaryTotal).toBe(85000.5); // ghost has no entry; side is income-only but still counted
    expect(s.otherIncomeTotal).toBe(12000);
    expect(s.incomeTotal).toBe(97000.5);
    expect(s.spentTotal).toBe(34800.5);
    expect(s.balance).toBe(62200);
  });

  test('other income never counts as spending or as an item to pay', () => {
    const s = summarize(persons, salaries, [exp('inc', { category: OTHER_INCOME, amount: 500 })]);
    expect(s.items).toBe(0);
    expect(s.spentTotal).toBe(0);
    expect(s.paidPct).toBe(0);
  });

  test('archived expenses are ignored everywhere', () => {
    const s = summarize(persons, salaries, [exp('old', { amount: 999, isArchived: true, personId: 'p1' }), exp('inc', { amount: 5, category: OTHER_INCOME, isArchived: true })]);
    expect(s.spentTotal).toBe(0);
    expect(s.otherIncomeTotal).toBe(0);
    expect(s.panelPersons[0].items).toBe(0);
  });

  test('paid vs unpaid totals, item counts and percentage', () => {
    const s = summarize(persons, salaries, [exp('a', { amount: 300, status: 'done' }), exp('b', { amount: 100 }), exp('c', { amount: 100 }), exp('d', { amount: 500, status: 'done' })]);
    expect(s.paidTotal).toBe(800);
    expect(s.unpaidTotal).toBe(200);
    expect([s.items, s.paidItems, s.paidPct]).toEqual([4, 2, 50]);
  });

  test('per-person lines: remaining, counts and spent percentage', () => {
    const s = summarize(persons, salaries, [exp('a', { personId: 'p1', amount: 20000, status: 'done' }), exp('b', { personId: 'p1', amount: 5000 })]);
    const line = s.panelPersons.find((l) => l.person.id === 'p1')!;
    expect(line).toMatchObject({ salary: 50000, spent: 25000, remaining: 25000, items: 2, paidItems: 1, spentPct: 50 });
    const hemaLine = s.panelPersons.find((l) => l.person.id === 'p2')!;
    expect(hemaLine).toMatchObject({ spent: 0, remaining: 30000.5, items: 0 });
  });

  test('overspending gives a negative remaining and caps the percentage at 100', () => {
    const s = summarize([hari], [salary('p1', 1000)], [exp('big', { personId: 'p1', amount: 2500 })]);
    expect(s.panelPersons[0]).toMatchObject({ remaining: -1500, spentPct: 100 });
    expect(s.balance).toBe(-1500);
  });

  test('income-only people are listed separately and have no expense panel', () => {
    const s = summarize(persons, salaries, []);
    expect(s.panelPersons.map((l) => l.person.id)).toEqual(['p1', 'p2']);
    expect(s.incomeOnly).toEqual([{ person: side, salary: 5000 }]);
  });

  test('expenses with no person, or a person without a panel, are unassigned', () => {
    const s = summarize(persons, salaries, [exp('a', { amount: 10 }), exp('b', { amount: 20, personId: 'p3' }), exp('c', { amount: 30, personId: 'p4' }), exp('d', { amount: 40, personId: 'p1' })]);
    expect(s.unassigned).toEqual({ total: 60, items: 3 });
  });

  test('a person who is not in this period does not affect totals', () => {
    const s = summarize([hari, ghost], [salary('p1', 100)], []);
    expect(s.salaryTotal).toBe(100);
    expect(s.panelPersons.map((l) => l.person.id)).toEqual(['p1']);
  });

  test('hasPanel undefined is treated as a panel person (older records)', () => {
    const s = summarize([{ id: 'p9', name: 'Old' }], [salary('p9', 10)], []);
    expect(s.panelPersons).toHaveLength(1);
  });
});

describe('filterExpenses', () => {
  const list = [
    exp('Rent', { personId: 'p1', status: 'done', notes: 'landlord', category: 'housing' }),
    exp('Groceries', { personId: 'p2', category: 'food' }),
    exp('Electricity', { personId: null, category: 'utilities' }),
  ];
  const none: ExpenseFilter = { query: '', status: 'all', personId: '' };
  const ids = (f: Partial<typeof none>) => filterExpenses(list, { ...none, ...f }, [hari, hema]).map((e) => e.id);

  test('no filters returns everything', () => expect(ids({})).toEqual(['Rent', 'Groceries', 'Electricity']));
  test('status filters', () => {
    expect(ids({ status: 'done' })).toEqual(['Rent']);
    expect(ids({ status: 'pending' })).toEqual(['Groceries', 'Electricity']);
  });
  test('person filter, including unassigned', () => {
    expect(ids({ personId: 'p2' })).toEqual(['Groceries']);
    expect(ids({ personId: UNASSIGNED })).toEqual(['Electricity']);
  });
  test('search is case-insensitive across label, notes, category and person name', () => {
    expect(ids({ query: 'RENT' })).toEqual(['Rent']);
    expect(ids({ query: 'landlord' })).toEqual(['Rent']);
    expect(ids({ query: 'food' })).toEqual(['Groceries']);
    expect(ids({ query: 'hema' })).toEqual(['Groceries']);
    expect(ids({ query: '  rent  ' })).toEqual(['Rent']);
    expect(ids({ query: 'zzz' })).toEqual([]);
  });
  test('filters combine', () => expect(ids({ status: 'pending', query: 'e', personId: 'p2' })).toEqual(['Groceries']));
});

describe('parseAmount', () => {
  test.each([['', 0], ['  ', 0], ['0', 0], ['250', 250], ['1250.75', 1250.75], ['.5', 0.5], ['12.', 12], [' 99 ', 99], ['9999999999.99', 9999999999.99]])('accepts %j', (text, out) => {
    expect(parseAmount(text)).toBe(out);
  });
  test.each([['abc'], ['-5'], ['1e5'], ['1,000'], ['1.2.3'], ['₹5'], ['NaN'], ['Infinity'], ['10000000000'], ['.']])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});

describe('expense form', () => {
  test('parseExpenseForm trims and normalises', () => {
    const r = parseExpenseForm({ label: '  Gas  ', amount: '42.5', category: 'utilities', personId: '', status: 'done', notes: '  ' });
    expect(r).toEqual({ value: { label: 'Gas', amount: 42.5, category: 'utilities', personId: null, status: 'done', notes: null } });
  });
  test('blank amount is zero; unknown status falls back to pending; empty category becomes other', () => {
    expect(parseExpenseForm({ ...emptyExpenseForm(), label: 'X', status: 'weird', category: '' })).toEqual({ value: { label: 'X', amount: 0, category: 'other', personId: null, status: 'pending', notes: null } });
  });
  test('rejects missing/long names and bad amounts with a message', () => {
    expect(parseExpenseForm({ ...emptyExpenseForm(), label: '   ' })).toEqual({ error: 'Name is required.' });
    expect(parseExpenseForm({ ...emptyExpenseForm(), label: 'x'.repeat(201) })).toEqual({ error: 'Name must be 200 characters or fewer.' });
    expect(parseExpenseForm({ ...emptyExpenseForm(), label: 'ok', amount: '-3' })).toEqual({ error: 'Enter a valid amount (numbers only).' });
  });
  test('formFromExpense reads API values (string decimals, nulls, income marker)', () => {
    expect(formFromExpense(exp('a', { label: 'Rent', amount: '25000.00', personId: 'p1', status: 'done', category: 'housing', notes: 'n' })))
      .toEqual({ label: 'Rent', amount: '25000', category: 'housing', personId: 'p1', status: 'done', notes: 'n' });
    expect(formFromExpense(exp('b', { amount: 0, category: null, notes: null, personId: null }))).toMatchObject({ amount: '', category: 'other', personId: '', notes: '' });
    expect(formFromExpense(exp('c', { category: OTHER_INCOME })).category).toBe('other');
  });
});

describe('labels', () => {
  test('cleanLabel trims and rejects blank or very long text', () => {
    expect(cleanLabel('  2026 ')).toBe('2026');
    expect(cleanLabel('   ')).toBeNull();
    expect(cleanLabel('x'.repeat(201))).toBeNull();
  });
  test('nextIncomeLabel numbers sources from 1', () => {
    expect(nextIncomeLabel(0)).toBe('Income source 1');
    expect(nextIncomeLabel(2)).toBe('Income source 3');
  });
});
