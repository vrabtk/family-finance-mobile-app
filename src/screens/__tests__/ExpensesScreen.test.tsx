// The whole Expenses module (screen + hook + logic) against a stateful in-memory fake of the API.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { OptionsProvider } from '../../options';
import { ExpensesScreen } from '../ExpensesScreen';

jest.mock('../../api');

const mockSession = { workspace: { id: 'w1', name: 'Family' }, canWrite: true, isAdmin: true };
jest.mock('../../session', () => ({
  useSession: () => mockSession,
  errorMessage: (e: any, fallback = 'Something went wrong.') => e?.message || fallback,
}));

const api = jest.mocked(apiModule) as any;

// ── fake backend ─────────────────────────────────────────────────────────────
let world: { years: any[]; groups: any[]; persons: any[]; expenses: any[]; salaries: any[] };
let seq = 0;
const nid = (p: string) => `${p}${++seq}`;

function seed() {
  seq = 100;
  world = {
    years: [
      { id: 'y1', label: '2026', hasSubgroups: true, status: 'active' },
      { id: 'y2', label: '2025', hasSubgroups: false, status: 'active' },
    ],
    groups: [
      { id: 'g1', yearId: 'y1', label: 'Mar-2026', status: 'active' },
      { id: 'g2', yearId: 'y1', label: 'Apr-2026', status: 'active' },
      { id: 'g3', yearId: 'y1', label: 'Feb-2026', status: 'archived' },
    ],
    persons: [
      { id: 'p1', name: 'Hari', color: '#0F766E', hasPanel: true },
      { id: 'p2', name: 'Hema', color: '#2563EB', hasPanel: true },
      { id: 'p3', name: 'Side', color: '#D97706', hasPanel: false },
    ],
    salaries: [
      { id: 's1', personId: 'p1', yearId: 'y1', groupId: 'g1', amount: '50000' },
      { id: 's2', personId: 'p2', yearId: 'y1', groupId: 'g1', amount: '30000' },
      { id: 's3', personId: 'p3', yearId: 'y1', groupId: 'g1', amount: '5000' },
      { id: 's4', personId: 'p1', yearId: 'y1', groupId: 'g2', amount: '40000' },
      { id: 's5', personId: 'p1', yearId: 'y2', groupId: null, amount: '20000' },
    ],
    expenses: [
      { id: 'e1', yearId: 'y1', groupId: 'g1', label: 'Rent', amount: '25000', status: 'done', category: 'housing', personId: 'p1', isArchived: false },
      { id: 'e2', yearId: 'y1', groupId: 'g1', label: 'Groceries', amount: '9800', status: 'pending', category: 'food', personId: 'p2', isArchived: false },
      { id: 'e3', yearId: 'y1', groupId: 'g1', label: 'Electricity', amount: '2150', status: 'pending', category: 'utilities', personId: null, isArchived: false },
      { id: 'e4', yearId: 'y1', groupId: 'g1', label: 'Rent received', amount: '12000', status: 'done', category: '__other_income__', personId: null, isArchived: false },
      { id: 'e5', yearId: 'y1', groupId: 'g1', label: 'Old gym', amount: '999', status: 'pending', category: 'other', personId: null, isArchived: true },
      { id: 'e6', yearId: 'y1', groupId: 'g2', label: 'April rent', amount: '24000', status: 'pending', category: 'housing', personId: 'p1', isArchived: false },
      { id: 'e10', yearId: 'y2', groupId: null, label: 'Flat bill', amount: '500', status: 'pending', category: 'other', personId: null, isArchived: false },
    ],
  };
}

function wireApi() {
  api.getYears.mockImplementation(async (_w: string, includeArchived = false) =>
    world.years.filter((y) => includeArchived || y.status !== 'archived').map((y) => ({ ...y, groups: world.groups.filter((g) => g.yearId === y.id).map((g) => ({ ...g })) })));
  api.getPersons.mockImplementation(async () => world.persons.map((p) => ({ ...p })));
  api.getExpenses.mockImplementation(async (_w: string, yearId: string, groupId?: string | null, includeArchived = false) =>
    world.expenses.filter((e) => e.yearId === yearId && (!groupId || e.groupId === groupId) && (includeArchived || !e.isArchived)).map((e) => ({ ...e })));
  api.getSalaries.mockImplementation(async (_w: string, yearId: string, groupId?: string | null) =>
    world.salaries.filter((s) => (groupId ? s.groupId === groupId : s.yearId === yearId && !s.groupId)).map((s) => ({ ...s })));

  api.createExpense.mockImplementation(async (_w: string, data: any) => { const e = { id: nid('e'), status: 'pending', isArchived: false, ...data }; world.expenses.push(e); return e; });
  api.updateExpense.mockImplementation(async (_w: string, id: string, data: any) => Object.assign(world.expenses.find((e) => e.id === id), data));
  api.archiveExpense.mockImplementation(async (_w: string, id: string) => Object.assign(world.expenses.find((e) => e.id === id), { isArchived: true }));
  api.restoreExpense.mockImplementation(async (_w: string, id: string) => Object.assign(world.expenses.find((e) => e.id === id), { isArchived: false }));
  api.deleteExpense.mockImplementation(async (_w: string, id: string) => { world.expenses = world.expenses.filter((e) => e.id !== id); });

  api.createYear.mockImplementation(async (_w: string, label: string, hasSubgroups: boolean) => { const y = { id: nid('y'), label, hasSubgroups, status: 'active' }; world.years.push(y); return y; });
  api.reorderYears.mockImplementation(async (_w: string, ids: string[]) => { world.years.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); });
  api.reorderGroups.mockImplementation(async (_w: string, yearId: string, ids: string[]) => { world.groups.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); });
  api.updateYear.mockImplementation(async (_w: string, id: string, label: string) => Object.assign(world.years.find((y) => y.id === id), { label }));
  api.archiveYear.mockImplementation(async (_w: string, id: string) => Object.assign(world.years.find((y) => y.id === id), { status: 'archived' }));
  api.restoreYear.mockImplementation(async (_w: string, id: string) => Object.assign(world.years.find((y) => y.id === id), { status: 'active' }));
  api.deleteYear.mockImplementation(async (_w: string, id: string) => {
    world.years = world.years.filter((y) => y.id !== id);
    world.groups = world.groups.filter((g) => g.yearId !== id);
    world.expenses = world.expenses.filter((e) => e.yearId !== id);
    world.salaries = world.salaries.filter((s) => s.yearId !== id);
  });
  api.createGroup.mockImplementation(async (_w: string, yearId: string, label: string) => { const g = { id: nid('g'), yearId, label, status: 'active' }; world.groups.push(g); return g; });
  api.updateGroup.mockImplementation(async (_w: string, _y: string, id: string, label: string) => Object.assign(world.groups.find((g) => g.id === id), { label }));
  api.archiveGroup.mockImplementation(async (_w: string, _y: string, id: string) => Object.assign(world.groups.find((g) => g.id === id), { status: 'archived' }));
  api.restoreGroup.mockImplementation(async (_w: string, _y: string, id: string) => Object.assign(world.groups.find((g) => g.id === id), { status: 'active' }));
  api.deleteGroup.mockImplementation(async (_w: string, _y: string, id: string) => {
    world.groups = world.groups.filter((g) => g.id !== id);
    world.expenses = world.expenses.filter((e) => e.groupId !== id);
    world.salaries = world.salaries.filter((s) => s.groupId !== id);
  });

  api.createPerson.mockImplementation(async (_w: string, data: any) => { const p = { id: nid('p'), ...data }; world.persons.push(p); return p; });
  api.saveSalary.mockImplementation(async (_w: string, d: any) => {
    const found = world.salaries.find((s) => s.personId === d.personId && s.yearId === d.yearId && (s.groupId ?? null) === d.groupId);
    if (found) found.amount = d.amount; else world.salaries.push({ id: nid('s'), ...d });
  });
  api.removeSalary.mockImplementation(async (_w: string, d: any) => {
    world.salaries = world.salaries.filter((s) => !(s.personId === d.personId && s.yearId === d.yearId && (s.groupId ?? null) === d.groupId));
  });
}

beforeEach(() => {
  seed();
  wireApi();
  const choices = ['food', 'housing', 'transport', 'utilities', 'education', 'medical', 'entertainment', 'other'].map((name, i) => ({ id: `o${i}`, name, sortOrder: i }));
  api.getOptions.mockResolvedValue({ expenseCategory: choices, loanType: [], investmentType: [], insuranceType: [] });
  Object.assign(mockSession, { canWrite: true, isAdmin: true });
});

// ── helpers ──────────────────────────────────────────────────────────────────
const as = (role: 'admin' | 'member' | 'viewer') => Object.assign(mockSession, { canWrite: role !== 'viewer', isAdmin: role === 'admin' });
// `section` opens the People or Other income segment; the default segment is the bills list.
const open = async (section?: 'people' | 'income') => {
  render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
  await screen.findByText('Left after expenses');
  if (section === 'people') fireEvent.press(screen.getByText(/^People/));
  if (section === 'income') fireEvent.press(screen.getByText('Other income'));
};
const sheet = () => within(screen.getAllByTestId('sheet').at(-1)!); // topmost open sheet
const closed = () => waitFor(() => expect(screen.queryAllByTestId('sheet').length).toBe(0));
const gone = (text: string) => waitFor(() => expect(screen.queryAllByText(text).length).toBe(0));
const goneLabel = (label: string) => waitFor(() => expect(screen.queryAllByLabelText(label).length).toBe(0));
const press = (text: string) => fireEvent.press(screen.getByText(text));
const pressIn = (text: string) => fireEvent.press(sheet().getByText(text));
const type = (label: string, value: string) => fireEvent.changeText(sheet().getByLabelText(label), value);
// Dropdowns: tap the field, then pick an option from the list that opens.
const choose = (field: string, option: string) => { fireEvent.press(sheet().getByLabelText(field)); fireEvent.press(sheet().getByText(option)); };
const showPeople = () => fireEvent.press(screen.getByText(/^People/));
const showIncome = () => fireEvent.press(screen.getByText('Other income'));
const showBills = () => fireEvent.press(screen.getByText('Bills'));
const manage = () => fireEvent.press(screen.getByLabelText('Manage years and months'));

// ── loading and summary ──────────────────────────────────────────────────────
describe('loading and summary', () => {
  test('shows the selected year and month, totals, people and expenses', async () => {
    await open();
    expect(screen.getByText('2026 · Mar-2026')).toBeTruthy();
    expect(screen.getByText('₹60,050')).toBeTruthy();                            // 97,000 income − 36,950 spending
    expect(screen.getByText('1 of 3 items paid (33%)')).toBeTruthy();
    for (const name of ['Rent', 'Groceries', 'Electricity']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('Old gym')).toBeNull();                            // archived is hidden
    expect(screen.queryByText('April rent')).toBeNull();                         // other month
    showPeople();
    expect(screen.getByText('Salary ₹50,000 · spent ₹25,000 · 1/1 paid')).toBeTruthy();
    expect(screen.getByText('Salary ₹30,000 · spent ₹9,800 · 0/1 paid')).toBeTruthy();
    expect(screen.getByText('Income only')).toBeTruthy();                        // Side has no panel
    expect(screen.getByText('1 expense not tied to a person')).toBeTruthy();
  });

  test('other income is listed under Other income, not among expenses or items to pay', async () => {
    await open();
    expect(screen.queryByText('Rent received')).toBeNull();                      // not among the bills
    showIncome();
    expect(screen.getAllByText('Rent received')).toHaveLength(1);
    expect(screen.getByLabelText('Income Rent received')).toBeTruthy();
    expect(screen.queryByLabelText('Mark Rent received paid')).toBeNull();
  });

  test('over budget is shown as such', async () => {
    world.expenses.push({ id: 'big', yearId: 'y1', groupId: 'g1', label: 'Car', amount: '100000', status: 'pending', category: 'other', personId: null, isArchived: false });
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('Over budget');
    expect(screen.getByText('₹39,950')).toBeTruthy(); // 97,000 income − 136,950 spending
  });

  test('a failed load shows the error with a working Retry', async () => {
    api.getYears.mockRejectedValueOnce(new Error('Server down'));
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('Server down');
    fireEvent.press(screen.getByText('Retry'));
    await screen.findByText('Left after expenses');
  });

  test('no years: empty state, with add controls only for people who can write', async () => {
    world.years = []; world.groups = [];
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('No year yet');
    expect(screen.getByText('Add year')).toBeTruthy();
  });

  test('no years for a viewer: no add controls', async () => {
    as('viewer'); world.years = []; world.groups = [];
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('No year yet');
    expect(screen.queryByText('Add year')).toBeNull();
    expect(screen.getByText('Ask a workspace member to add a year.')).toBeTruthy();
  });

  test('a monthly year with no months asks for a month', async () => {
    world.groups = world.groups.filter((g) => g.yearId !== 'y1');
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('No month yet');
    expect(screen.getByText('Add month')).toBeTruthy();
  });
});

// ── period selection ─────────────────────────────────────────────────────────
describe('periods', () => {
  test('switching month shows that month only', async () => {
    await open();
    press('Apr-2026');
    await screen.findByText('April rent');
    expect(screen.getByText('2026 · Apr-2026')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
    expect(api.getExpenses).toHaveBeenLastCalledWith('w1', 'y1', 'g2', false);
  });

  test('opens on the month it is sent to (e.g. from the Home dashboard)', async () => {
    render(<ExpensesScreen focus={{ yearId: 'y1', groupId: 'g2' }} />);
    await screen.findByText('April rent');
    expect(screen.getByText('2026 · Apr-2026')).toBeTruthy();
    expect(api.getExpenses).toHaveBeenCalledWith('w1', 'y1', 'g2', false);
    expect(api.getExpenses).not.toHaveBeenCalledWith('w1', 'y1', 'g1', false); // never loads the default month first
  });

  test('opens on a flat year when that is the focus', async () => {
    render(<ExpensesScreen focus={{ yearId: 'y2', groupId: null }} />);
    await screen.findByText('Flat bill');
  });

  test('while another month loads, the previous month is not shown (no stale or zero numbers)', async () => {
    await open();
    let release!: (rows: any[]) => void;
    api.getExpenses.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    press('Apr-2026');
    await waitFor(() => expect(screen.queryAllByText('Groceries').length).toBe(0)); // March data is gone at once
    expect(screen.queryAllByText('Left after expenses').length).toBe(0);            // and no empty ₹0 summary replaces it
    release(world.expenses.filter((e) => e.groupId === 'g2').map((e) => ({ ...e })));
    await screen.findByText('April rent');
    expect(screen.getByText('Left after expenses')).toBeTruthy();
  });

  test('a flat year has no month picker and loads year-level data', async () => {
    await open();
    press('2025');
    await screen.findByText('Flat bill');
    expect(screen.queryByText('Add month')).toBeNull();
    showPeople();
    expect(screen.getByText('Salary ₹20,000 · spent ₹0 · 0/0 paid')).toBeTruthy();
    expect(api.getExpenses).toHaveBeenLastCalledWith('w1', 'y2', null, false);
  });

  test('archived months and years are hidden until "Shown" is chosen in Manage', async () => {
    await open();
    expect(screen.queryByText('Feb-2026 (archived)')).toBeNull();
    manage();
    pressIn('Shown');
    await screen.findByText('Feb-2026 (archived)');
  });

  test('add a monthly year: it is created and selected', async () => {
    await open();
    press('Add year');
    type('Year', '2027');
    pressIn('Add');
    await closed();
    expect(api.createYear).toHaveBeenCalledWith('w1', '2027', true);
    await screen.findByText('No month yet');
    expect(screen.getAllByText('2027')).toHaveLength(2); // the subtitle and the new year chip
  });

  test('add a one-list year when "No, one list" is chosen', async () => {
    await open();
    press('Add year');
    type('Year', 'FY27');
    pressIn('No, one list');
    pressIn('Add');
    await closed();
    expect(api.createYear).toHaveBeenCalledWith('w1', 'FY27', false);
    await screen.findByText('Left after expenses'); // flat year is immediately usable
  });

  test('add a month: it is created and selected', async () => {
    await open();
    press('Add month');
    type('Month', 'May-2026');
    pressIn('Add');
    await closed();
    expect(api.createGroup).toHaveBeenCalledWith('w1', 'y1', 'May-2026');
    await screen.findByText('2026 · May-2026');
  });

  test('blank year or month names are rejected before any request', async () => {
    await open();
    press('Add year');
    pressIn('Add');
    expect(await sheet().findByText('Year name is required.')).toBeTruthy();
    expect(api.createYear).not.toHaveBeenCalled();
  });

  test('server errors while saving stay in the sheet', async () => {
    api.createGroup.mockRejectedValueOnce(new Error('label required'));
    await open();
    press('Add month');
    type('Month', 'X');
    pressIn('Add');
    expect(await sheet().findByText('label required')).toBeTruthy();
  });

  test('years and months can be moved up and down; the new order is saved and shown', async () => {
    await open();
    manage();
    fireEvent.press(screen.getByLabelText('Move Apr-2026 up'));
    await waitFor(() => expect(api.reorderGroups).toHaveBeenCalledWith('w1', 'y1', ['g2', 'g1']));
    fireEvent.press(await screen.findByLabelText('Move 2025 up'));
    await waitFor(() => expect(api.reorderYears).toHaveBeenCalledWith('w1', ['y2', 'y1']));
  });

  test('Bills, People and Other income are separate views with their own add buttons', async () => {
    await open();
    expect(screen.queryByText('Add person')).toBeNull();
    expect(screen.queryByText('Add other income')).toBeNull();
    showPeople();
    expect(screen.getByText('Add person')).toBeTruthy();
    expect(screen.queryByText('Rent')).toBeNull();
    showIncome();
    expect(screen.getByText('Add other income')).toBeTruthy();
    showBills();
    expect(screen.getByText('Rent')).toBeTruthy();
  });

  test('the bills list is split into To pay and Paid with counts and totals; a status filter shows one flat list', async () => {
    await open();
    expect(screen.getByText('To pay · 2')).toBeTruthy();   // Groceries and Electricity
    expect(screen.getByText('Paid · 1')).toBeTruthy();     // Rent
    fireEvent.press(screen.getAllByText('Pending')[0]);    // the filter chip comes before the badges
    expect(screen.queryByText('To pay · 2')).toBeNull();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.queryByText('Rent')).toBeNull();
  });

  test('viewers cannot reorder', async () => {
    Object.assign(mockSession, { canWrite: false, isAdmin: false });
    await open();
    manage();
    expect(screen.queryByLabelText('Move 2025 up')).toBeNull();
  });

  test('rename year and rename month', async () => {
    await open();
    manage();
    pressIn('Rename year');
    await waitFor(() => expect(sheet().getByLabelText('Year').props.value).toBe('2026'));
    type('Year', 'FY 2026');
    pressIn('Save');
    await closed();
    expect(api.updateYear).toHaveBeenCalledWith('w1', 'y1', 'FY 2026');
    await screen.findByText('FY 2026 · Mar-2026');

    manage();
    pressIn('Rename month');
    type('Month', 'March');
    pressIn('Save');
    await closed();
    expect(api.updateGroup).toHaveBeenCalledWith('w1', 'y1', 'g1', 'March');
    await screen.findByText('FY 2026 · March');
  });

  test('archive a month (confirm first); it disappears and the next month is selected', async () => {
    await open();
    manage();
    pressIn('Archive month');
    expect(api.archiveGroup).not.toHaveBeenCalled();
    pressIn('Archive');
    await closed();
    expect(api.archiveGroup).toHaveBeenCalledWith('w1', 'y1', 'g1');
    await screen.findByText('2026 · Apr-2026');
    expect(screen.queryByText('Mar-2026')).toBeNull();
  });

  test('restore an archived month', async () => {
    await open();
    manage();
    pressIn('Shown');
    await closed.call(null).catch(() => undefined);
    // the sheet stays open after toggling; pick the archived month from the chips behind it
    fireEvent.press(screen.getByText('Feb-2026 (archived)'));
    await waitFor(() => expect(sheet().getByText('Restore month')).toBeTruthy());
    pressIn('Restore month');
    await closed();
    expect(api.restoreGroup).toHaveBeenCalledWith('w1', 'y1', 'g3');
  });

  test('archive and restore a year', async () => {
    await open();
    manage();
    pressIn('Archive year');
    pressIn('Archive');
    await closed();
    expect(api.archiveYear).toHaveBeenCalledWith('w1', 'y1');
    await screen.findByText('Flat bill'); // falls back to the next year, a flat one
    manage();
    pressIn('Shown');
    fireEvent.press(await screen.findByText('2026 (archived)'));
    await waitFor(() => expect(sheet().getByText('Restore year')).toBeTruthy());
    pressIn('Restore year');
    await closed();
    expect(api.restoreYear).toHaveBeenCalledWith('w1', 'y1');
  });

  test('delete a month needs confirmation and removes its data', async () => {
    await open();
    manage();
    pressIn('Delete month');
    expect(sheet().getByText('Delete Mar-2026?')).toBeTruthy();
    expect(api.deleteGroup).not.toHaveBeenCalled();
    pressIn('Delete');
    await closed();
    expect(api.deleteGroup).toHaveBeenCalledWith('w1', 'y1', 'g1');
    await screen.findByText('2026 · Apr-2026');
  });

  test('delete a year', async () => {
    await open();
    manage();
    pressIn('Delete year');
    pressIn('Delete');
    await closed();
    expect(api.deleteYear).toHaveBeenCalledWith('w1', 'y1');
    await screen.findByText('Flat bill');
  });

  test('cancelling a confirmation changes nothing', async () => {
    await open();
    manage();
    pressIn('Delete year');
    pressIn('Cancel');
    expect(api.deleteYear).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete 2026?')).toBeNull();      // the confirmation is gone
    expect(screen.getAllByTestId('sheet')).toHaveLength(1);     // Manage is still open
  });

  test('members can rename but cannot archive or delete', async () => {
    as('member');
    await open();
    manage();
    expect(sheet().getByText('Rename year')).toBeTruthy();
    expect(sheet().queryByText('Archive year')).toBeNull();
    expect(sheet().queryByText('Delete year')).toBeNull();
    expect(sheet().queryByText('Archive month')).toBeNull();
    expect(sheet().queryByText('Delete month')).toBeNull();
  });

  test('viewers see read-only Manage', async () => {
    as('viewer');
    await open();
    manage();
    expect(sheet().queryByText('Rename year')).toBeNull();
    expect(sheet().getByText('You have read-only access to this workspace.')).toBeTruthy();
  });
});

// ── expenses ─────────────────────────────────────────────────────────────────
describe('expenses', () => {
  test('tick an expense paid: updates at once, persists, and recalculates', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Mark Groceries paid'));
    await screen.findByLabelText('Mark Groceries pending');
    expect(screen.getByText('2 of 3 items paid (67%)')).toBeTruthy();
    expect(api.updateExpense).toHaveBeenCalledWith('w1', 'e2', { status: 'done' });
  });

  test('untick a paid expense', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Mark Rent pending'));
    await screen.findByLabelText('Mark Rent paid');
    expect(api.updateExpense).toHaveBeenCalledWith('w1', 'e1', { status: 'pending' });
    expect(screen.getByText('0 of 3 items paid (0%)')).toBeTruthy();
  });

  test('a refused update is rolled back and the reason is shown', async () => {
    api.updateExpense.mockRejectedValueOnce(new Error('Requires member role'));
    await open();
    fireEvent.press(screen.getByLabelText('Mark Groceries paid'));
    await screen.findByText('Requires member role');
    expect(screen.getByLabelText('Mark Groceries paid')).toBeTruthy();
    expect(screen.getByText('1 of 3 items paid (33%)')).toBeTruthy();
  });

  test('add an expense with every field', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Add expense'));
    type('Name', 'Water bill');
    type('Amount (₹)', '480.5');
    choose('Category', 'Utilities');
    choose('Paid by', 'Hema');
    pressIn('Paid');
    type('Notes (optional)', 'quarterly');
    pressIn('Save');
    await closed();
    expect(api.createExpense).toHaveBeenCalledWith('w1', {
      label: 'Water bill', amount: 480.5, category: 'utilities', personId: 'p2', status: 'done', notes: 'quarterly', yearId: 'y1', groupId: 'g1',
    });
    await screen.findByText('Water bill');
    expect(screen.getByText('2 of 4 items paid (50%)')).toBeTruthy();
  });

  test('category and paid-by are dropdowns that show the current choice and let you change it', async () => {
    await open();
    fireEvent.press(screen.getByText('Groceries'));
    await waitFor(() => expect(sheet().getByLabelText('Category').props.accessibilityValue.text).toBe('Food'));
    expect(sheet().getByLabelText('Paid by').props.accessibilityValue.text).toBe('Hema');

    fireEvent.press(sheet().getByLabelText('Category'));
    expect(sheet().getAllByRole('radio')).toHaveLength(8);                    // every category is listed
    expect(sheet().getByRole('radio', { selected: true })).toBeTruthy();      // the current one is marked
    fireEvent.press(sheet().getByText('Medical'));
    expect(sheet().getByLabelText('Category').props.accessibilityValue.text).toBe('Medical'); // list closed, field updated

    choose('Paid by', 'Nobody');
    expect(sheet().getByLabelText('Paid by').props.accessibilityValue.text).toBe('Nobody');
    pressIn('Save');
    await closed();
    expect(api.updateExpense).toHaveBeenCalledWith('w1', 'e2', expect.objectContaining({ category: 'medical', personId: null }));
  });

  test('closing a dropdown without choosing keeps the value', async () => {
    await open();
    fireEvent.press(screen.getByText('Groceries'));
    fireEvent.press(await waitFor(() => sheet().getByLabelText('Category')));
    fireEvent.press(sheet().getByLabelText('Close'));
    expect(sheet().getByLabelText('Category').props.accessibilityValue.text).toBe('Food');
  });

  test('Paid by is only offered when the month has people with their own expenses', async () => {
    world.salaries = world.salaries.filter((s) => s.groupId !== 'g1'); // nobody in March, so the month is over budget
    render(<OptionsProvider><ExpensesScreen /></OptionsProvider>);
    await screen.findByText('Over budget');
    fireEvent.press(screen.getByLabelText('Add expense'));
    expect(sheet().queryByLabelText('Paid by')).toBeNull();
    expect(sheet().getByLabelText('Category')).toBeTruthy();
  });

  test('add with just a name defaults to zero, pending, no person', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Add expense'));
    type('Name', '  Misc  ');
    pressIn('Save');
    await closed();
    expect(api.createExpense).toHaveBeenCalledWith('w1', expect.objectContaining({ label: 'Misc', amount: 0, status: 'pending', personId: null, category: 'other', notes: null }));
  });

  test('in a flat year the expense is created without a month', async () => {
    await open();
    press('2025');
    await screen.findByText('Flat bill');
    fireEvent.press(screen.getByLabelText('Add expense'));
    type('Name', 'Tax');
    pressIn('Save');
    await closed();
    expect(api.createExpense).toHaveBeenCalledWith('w1', expect.objectContaining({ yearId: 'y2', groupId: null }));
  });

  test('validation: missing name, bad amount, over-long name', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Add expense'));
    pressIn('Save');
    expect(await sheet().findByText('Name is required.')).toBeTruthy();
    type('Name', 'X');
    type('Amount (₹)', '12abc');
    pressIn('Save');
    expect(await sheet().findByText('Enter a valid amount (numbers only).')).toBeTruthy();
    type('Name', 'x'.repeat(201));
    type('Amount (₹)', '5');
    pressIn('Save');
    expect(await sheet().findByText('Name must be 200 characters or fewer.')).toBeTruthy();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  test('a server error on save is shown and the sheet stays open for retry', async () => {
    api.createExpense.mockRejectedValueOnce(new Error('Year, month or person not found'));
    await open();
    fireEvent.press(screen.getByLabelText('Add expense'));
    type('Name', 'Gas');
    pressIn('Save');
    expect(await sheet().findByText('Year, month or person not found')).toBeTruthy();
    pressIn('Save');
    await closed();
    expect(api.createExpense).toHaveBeenCalledTimes(2);
  });

  test('edit an expense: the sheet is pre-filled and only changes are saved through the form', async () => {
    await open();
    fireEvent.press(screen.getByText('Groceries'));
    await waitFor(() => expect(sheet().getByLabelText('Name').props.value).toBe('Groceries'));
    expect(sheet().getByLabelText('Amount (₹)').props.value).toBe('9800');
    type('Amount (₹)', '10250');
    pressIn('Save');
    await closed();
    expect(api.updateExpense).toHaveBeenCalledWith('w1', 'e2', { label: 'Groceries', amount: 10250, category: 'food', personId: 'p2', status: 'pending', notes: null });
    showPeople();
    expect(screen.getByText('Salary ₹30,000 · spent ₹10,250 · 0/1 paid')).toBeTruthy();
  });

  test('archive an expense: it leaves the list and the totals', async () => {
    await open();
    fireEvent.press(screen.getByText('Electricity'));
    pressIn('Archive');
    await closed();
    expect(api.archiveExpense).toHaveBeenCalledWith('w1', 'e3');
    await gone('Electricity');
    expect(screen.getByText('1 of 2 items paid (50%)')).toBeTruthy();
    expect(screen.queryByText('1 expense not tied to a person')).toBeNull();
  });

  test('show archived: archived rows appear greyed, can be restored', async () => {
    await open();
    manage();
    pressIn('Shown');
    fireEvent.press(sheet().getByLabelText('Close'));
    await screen.findByText('Old gym');
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('1 of 3 items paid (33%)')).toBeTruthy(); // archived never counts

    fireEvent.press(screen.getByText('Old gym'));
    expect(sheet().getByText('Archived expense')).toBeTruthy();
    expect(sheet().queryByText('Save')).toBeNull();                    // archived expenses are not editable
    pressIn('Restore');
    await closed();
    expect(api.restoreExpense).toHaveBeenCalledWith('w1', 'e5');
    await waitFor(() => expect(screen.getByText('1 of 4 items paid (25%)')).toBeTruthy());
  });

  test('an archived expense cannot be ticked', async () => {
    await open();
    manage();
    pressIn('Shown');
    fireEvent.press(sheet().getByLabelText('Close'));
    await screen.findByText('Old gym');
    fireEvent.press(screen.getByLabelText('Mark Old gym paid'));
    expect(api.updateExpense).not.toHaveBeenCalled();
  });

  test('delete forever (admin): asks first, then removes the expense', async () => {
    await open();
    fireEvent.press(screen.getByText('Electricity'));
    pressIn('Delete');
    expect(sheet().getByText('Delete permanently?')).toBeTruthy();
    expect(api.deleteExpense).not.toHaveBeenCalled();
    pressIn('Delete'); // confirm
    await waitFor(() => expect(api.deleteExpense).toHaveBeenCalledWith('w1', 'e3'));
    await gone('Electricity');
  });

  test('members can archive but not delete', async () => {
    as('member');
    await open();
    fireEvent.press(screen.getByText('Electricity'));
    expect(sheet().getByText('Archive')).toBeTruthy();
    expect(sheet().queryByText('Delete')).toBeNull();
  });

  test('viewers can read but not change anything', async () => {
    as('viewer');
    await open();
    expect(screen.queryByLabelText('Add expense')).toBeNull();
    fireEvent.press(screen.getByLabelText('Mark Groceries paid'));
    fireEvent.press(screen.getByText('Groceries'));
    showPeople();
    expect(screen.queryByText('Add person')).toBeNull();
    fireEvent.press(screen.getByLabelText('Hari salary'));
    showIncome();
    expect(screen.queryByText('Add other income')).toBeNull();
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(api.updateExpense).not.toHaveBeenCalled();
  });
});

// ── search and filters ───────────────────────────────────────────────────────
describe('search and filters', () => {
  const search = (text: string) => fireEvent.changeText(screen.getByLabelText('Search expenses'), text);
  const filterChip = (text: string) => fireEvent.press(within(screen.getByText('Expenses').parent!.parent!).getByText(text));

  test('search by name, category or person; clear restores the list', async () => {
    await open();
    search('groc');
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.queryByText('Rent')).toBeNull();
    search('utilities');
    expect(screen.getByText('Electricity')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
    search('hari');
    expect(screen.getByText('Rent')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Groceries')).toBeTruthy();
  });

  test('no match shows a helpful empty state', async () => {
    await open();
    search('zzzz');
    expect(screen.getByText('No matching expenses')).toBeTruthy();
    expect(screen.getByText('Try a different search or filter.')).toBeTruthy();
  });

  test('status filter: Pending and Paid', async () => {
    await open();
    fireEvent.press(screen.getAllByText('Pending')[0]); // the chip comes before the 'Pending' badges
    expect(screen.queryByText('Rent')).toBeNull();
    expect(screen.getByText('Groceries')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Paid')[0]);
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
    fireEvent.press(screen.getByText('All'));
    expect(screen.getByText('Groceries')).toBeTruthy();
  });

  test('person filter, including Unassigned', async () => {
    await open();
    fireEvent.press(screen.getAllByText('Hema').at(-1)!); // the filter chip is rendered after the people list
    expect(screen.queryByText('Rent')).toBeNull();
    expect(screen.getByText('Groceries')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Unassigned').at(-1)!);
    expect(screen.getByText('Electricity')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
    fireEvent.press(screen.getByText('Everyone'));
    expect(screen.getByText('Rent')).toBeTruthy();
  });

  test('filters are not shown when there are no expenses', async () => {
    world.expenses = world.expenses.filter((e) => e.groupId !== 'g1');
    await open();
    expect(screen.queryByLabelText('Search expenses')).toBeNull();
    expect(screen.getByText('No expenses yet')).toBeTruthy();
    expect(screen.getByText('Tap + to add your first expense.')).toBeTruthy();
    void filterChip;
  });
});

// ── other income ─────────────────────────────────────────────────────────────
describe('other income', () => {
  test('add: defaults the name, marks the expense as income and counts it in the balance', async () => {
    await open('income');
    press('Add other income');
    expect(sheet().getByLabelText('Name').props.value).toBe('Income source 2'); // one source already exists
    type('Name', 'Bonus');
    type('Amount (₹)', '3000');
    pressIn('Save');
    await closed();
    expect(api.createExpense).toHaveBeenCalledWith('w1', {
      label: 'Bonus', amount: 3000, status: 'done', category: '__other_income__', personId: null, yearId: 'y1', groupId: 'g1',
    });
    await screen.findByLabelText('Income Bonus');
    expect(screen.getByText('₹63,050')).toBeTruthy();
    expect(screen.getByText('1 of 3 items paid (33%)')).toBeTruthy(); // income is not an item to pay
  });

  test('edit changes name and amount only', async () => {
    await open('income');
    fireEvent.press(screen.getByLabelText('Income Rent received'));
    type('Amount (₹)', '15000');
    pressIn('Save');
    await closed();
    expect(api.updateExpense).toHaveBeenCalledWith('w1', 'e4', { label: 'Rent received', amount: 15000 });
    await waitFor(() => expect(screen.getByText('₹63,050')).toBeTruthy());
  });

  test('remove archives it', async () => {
    await open('income');
    fireEvent.press(screen.getByLabelText('Income Rent received'));
    pressIn('Remove');
    await closed();
    expect(api.archiveExpense).toHaveBeenCalledWith('w1', 'e4');
    await goneLabel('Income Rent received');
    expect(screen.getByText('₹48,050')).toBeTruthy();
  });

  test('validation: name and amount', async () => {
    await open('income');
    press('Add other income');
    type('Name', '   ');
    pressIn('Save');
    expect(await sheet().findByText('Name is required.')).toBeTruthy();
    type('Name', 'X');
    type('Amount (₹)', '-4');
    pressIn('Save');
    expect(await sheet().findByText('Enter a valid amount (numbers only).')).toBeTruthy();
    expect(api.createExpense).not.toHaveBeenCalled();
  });
});

// ── people and salaries ──────────────────────────────────────────────────────
describe('people and salaries', () => {
  test('add a person with a panel: person and salary are created for this month', async () => {
    await open('people');
    press('Add person');
    type('Name', 'Asha');
    type('Salary (₹)', '42000');
    pressIn('Add person');
    await closed();
    expect(api.createPerson).toHaveBeenCalledWith('w1', expect.objectContaining({ name: 'Asha', baseSalary: 42000, hasPanel: true }));
    expect(api.saveSalary).toHaveBeenCalledWith('w1', { personId: expect.any(String), yearId: 'y1', groupId: 'g1', amount: 42000 });
    await screen.findByText('Salary ₹42,000 · spent ₹0 · 0/0 paid');
  });

  test('add an income-only person', async () => {
    await open('people');
    press('Add person');
    type('Name', 'Tenant');
    type('Salary (₹)', '9000');
    pressIn('Income only');
    pressIn('Add person');
    await closed();
    expect(api.createPerson).toHaveBeenCalledWith('w1', expect.objectContaining({ hasPanel: false }));
    await waitFor(() => expect(screen.getAllByText('Income only')).toHaveLength(2));
  });

  test('colour can be chosen', async () => {
    await open('people');
    press('Add person');
    type('Name', 'Asha');
    fireEvent.press(sheet().getByLabelText('Colour #7C3AED'));
    pressIn('Add person');
    await closed();
    expect(api.createPerson).toHaveBeenCalledWith('w1', expect.objectContaining({ color: '#7C3AED' }));
  });

  test('validation: name and salary', async () => {
    await open('people');
    press('Add person');
    pressIn('Add person');
    expect(await sheet().findByText('Name is required.')).toBeTruthy();
    type('Name', 'Asha');
    type('Salary (₹)', 'lots');
    pressIn('Add person');
    expect(await sheet().findByText('Enter a valid salary (numbers only).')).toBeTruthy();
    expect(api.createPerson).not.toHaveBeenCalled();
  });

  test('if saving the salary fails the error is shown', async () => {
    api.saveSalary.mockRejectedValueOnce(new Error('Year, month or person not found'));
    await open('people');
    press('Add person');
    type('Name', 'Asha');
    pressIn('Add person');
    expect(await sheet().findByText('Year, month or person not found')).toBeTruthy();
  });

  test('edit a salary for this month only', async () => {
    await open('people');
    fireEvent.press(screen.getByLabelText('Hari salary'));
    await waitFor(() => expect(sheet().getByLabelText('Salary for this month (₹)').props.value).toBe('50000'));
    type('Salary for this month (₹)', '55000');
    pressIn('Save');
    await closed();
    expect(api.saveSalary).toHaveBeenCalledWith('w1', { personId: 'p1', yearId: 'y1', groupId: 'g1', amount: 55000 });
    await screen.findByText('Salary ₹55,000 · spent ₹25,000 · 1/1 paid');
    press('Apr-2026');
    await waitFor(() => expect(screen.getByText('Salary ₹40,000 · spent ₹24,000 · 0/1 paid')).toBeTruthy()); // April untouched
  });

  test('income-only people can have their salary edited too', async () => {
    await open('people');
    fireEvent.press(screen.getByLabelText('Side salary'));
    type('Salary for this month (₹)', '6000');
    pressIn('Save');
    await closed();
    expect(api.saveSalary).toHaveBeenCalledWith('w1', { personId: 'p3', yearId: 'y1', groupId: 'g1', amount: 6000 });
  });

  test('remove a person from this month: confirm, then only this month changes', async () => {
    await open('people');
    fireEvent.press(screen.getByLabelText('Hema salary'));
    pressIn('Remove from month');
    expect(sheet().getByText('Remove Hema?')).toBeTruthy();
    expect(api.removeSalary).not.toHaveBeenCalled();
    pressIn('Remove');
    await closed();
    expect(api.removeSalary).toHaveBeenCalledWith('w1', { personId: 'p2', yearId: 'y1', groupId: 'g1' });
    await goneLabel('Hema salary');
    showBills();
    expect(screen.getByText('Groceries')).toBeTruthy(); // their expenses remain, now unassigned
    expect(world.persons.some((p) => p.id === 'p2')).toBe(true); // the person still exists in the workspace
  });

  test('in a flat year the wording and scope use "year"', async () => {
    await open('people');
    press('2025');
    await waitFor(() => expect(api.getExpenses).toHaveBeenLastCalledWith('w1', 'y2', null, false));
    fireEvent.press(await screen.findByLabelText('Hari salary'));
    expect(sheet().getByText('Remove from year')).toBeTruthy();
    pressIn('Remove from year');
    pressIn('Remove');
    await closed();
    expect(api.removeSalary).toHaveBeenCalledWith('w1', { personId: 'p1', yearId: 'y2', groupId: null });
  });

  test('a person with no salary entry in the month is not listed', async () => {
    await open('people');
    press('Apr-2026');
    await waitFor(() => expect(api.getExpenses).toHaveBeenLastCalledWith('w1', 'y1', 'g2', false));
    await waitFor(() => expect(screen.queryByLabelText('Hema salary')).toBeNull());
    expect(screen.getByLabelText('Hari salary')).toBeTruthy();
  });
});
