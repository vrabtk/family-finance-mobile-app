import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { HomeScreen } from '../HomeScreen';

jest.mock('../../api');
jest.mock('../../session', () => ({
  useSession: () => ({ session: { user: { name: 'Hari Krishna' } }, workspace: { id: 'w1', name: 'Family' } }),
  errorMessage: (e: any, fallback = 'Something went wrong.') => e?.message || fallback,
}));
const mockPrefs: Record<string, unknown> = {};
jest.mock('../../storage', () => ({
  loadPrefs: jest.fn(async () => ({ ...mockPrefs })),
  savePrefs: jest.fn(async (p: Record<string, unknown>) => { Object.keys(mockPrefs).forEach((k) => delete mockPrefs[k]); Object.assign(mockPrefs, p); }),
}));

jest.setTimeout(20000);
const api = jest.mocked(apiModule) as any;
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// Labels avoid month names so the "current period" is always the latest one with activity.
const periods = [
  { yearId: 'y1', yearLabel: '2026', groupId: 'g1', label: 'Q1', totalIncome: 100000, totalExpenses: 40000, surplus: 60000 },
  { yearId: 'y1', yearLabel: '2026', groupId: 'g2', label: 'Q2', totalIncome: 50000, totalExpenses: 62000, surplus: -12000 },
];
const allTime = { totalExpenses: 500000, expenseCount: 60, totalDebt: 450000, monthlyEmi: 10000, totalInvested: 640000, currentValue: 712000, investmentGain: 72000, topCategories: [] };
const banks = [{ id: 'b1', name: 'HDFC', sections: [{ id: 's1', name: 'Savings', entries: [{ id: 'e1', label: 'A', amount: '100000' }] }] }];
const expenses = [
  { id: 'x1', label: 'House rent', amount: '25000', status: 'done', category: 'housing', isArchived: false },
  { id: 'x2', label: 'School fees', amount: '12000', status: 'pending', category: 'education', isArchived: false },
];
const policies = [{ id: 'p1', name: 'Star Health', premiumAmount: '28000', nextDueDate: day(-2) }];

const go = jest.fn();
const open = async () => { render(<HomeScreen go={go} />); await screen.findByLabelText('₹3,62,000'); };

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockPrefs).forEach((k) => delete mockPrefs[k]);
  api.getAnalyticsAllTime.mockResolvedValue(allTime);
  api.getAnalyticsMonthly.mockResolvedValue(periods);
  api.banksApi.list.mockResolvedValue(banks);
  api.insuranceApi.list.mockResolvedValue(policies);
  api.getExpenses.mockResolvedValue(expenses);
});

describe('smart highlights', () => {
  test('are worked out from the month: overspending first, then the overdue premium', async () => {
    await open();
    expect(screen.getByText('Spending is above income')).toBeTruthy();      // Q2: 62,000 against 50,000
    expect(screen.getByText('Star Health premium is overdue')).toBeTruthy();
    expect(screen.getByText('Overdue by 2 days.')).toBeTruthy();
  });

  test('their action buttons open the right screen', async () => {
    await open();
    fireEvent.press(screen.getByText('Open insurance'));
    expect(go).toHaveBeenCalledWith('more', { more: 'insurance' });
    fireEvent.press(screen.getAllByText('See expenses')[0]);
    expect(go).toHaveBeenCalledWith('expenses');
  });

  test('a calm month says so', async () => {
    api.getAnalyticsMonthly.mockResolvedValue([{ ...periods[0], totalExpenses: 90000 }]);
    api.insuranceApi.list.mockResolvedValue([]);
    api.getExpenses.mockResolvedValue([]);
    await open();
    expect(screen.getByText('All clear')).toBeTruthy();
  });
});

describe('getting started checklist', () => {
  test('ticks what is already there and opens the next missing step', async () => {
    api.getAnalyticsAllTime.mockResolvedValue({ ...allTime, totalDebt: 0, totalInvested: 0, currentValue: 0 });
    api.insuranceApi.list.mockResolvedValue([]);
    api.getAnalyticsMonthly.mockResolvedValue(periods);
    api.banksApi.list.mockResolvedValue(banks);
    render(<HomeScreen go={go} />);
    await screen.findByText('Getting started');
    expect(screen.getByLabelText('Add a year and a month, done')).toBeTruthy();
    expect(screen.getByLabelText('Add a bank account, done')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add an insurance policy'));
    expect(go).toHaveBeenCalledWith('more', { more: 'insurance' });
  });

  test('disappears once everything is done', async () => {
    await open();
    expect(screen.queryByText('Getting started')).toBeNull();
  });
});

describe('customize the dashboard', () => {
  test('hiding a section removes it, and the choice is saved on the device', async () => {
    await open();
    expect(screen.getByText('Your money at a glance')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Customize dashboard'));
    fireEvent.press(await screen.findByLabelText('Hide Your money at a glance'));
    await waitFor(() => expect(mockPrefs.homeLayout).toMatchObject({ hidden: ['tiles'] }));
    fireEvent.press(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByText('Your money at a glance')).toBeNull());
  });

  test('a saved layout is applied on the next visit (hidden and reordered)', async () => {
    mockPrefs.homeLayout = { order: ['tiles', 'insights'], hidden: ['actions', 'trend'] };
    await open();
    expect(screen.queryByText('Add expense')).toBeNull();                      // quick actions hidden
    const all = screen.root.findAll((n: any) => typeof n.props?.children === 'string').map((n: any) => n.props.children);
    expect(all.indexOf('Your money at a glance')).toBeLessThan(all.indexOf('Spending is above income')); // tiles now before highlights
  });

  test('reset brings everything back', async () => {
    mockPrefs.homeLayout = { order: [], hidden: ['tiles'] };
    await open();
    expect(screen.queryByText('Your money at a glance')).toBeNull();
    fireEvent.press(screen.getByLabelText('Customize dashboard'));
    fireEvent.press(await screen.findByText('Reset to default'));
    await waitFor(() => expect(mockPrefs.homeLayout).toMatchObject({ hidden: [] }));
    fireEvent.press(screen.getByLabelText('Close'));
    await screen.findByText('Your money at a glance');
  });

  test('moving a section changes the saved order; garbage in storage is ignored', async () => {
    mockPrefs.homeLayout = 'nonsense';
    await open();
    fireEvent.press(screen.getByLabelText('Customize dashboard'));
    fireEvent.press(await screen.findByLabelText('Move Net worth up'));
    await waitFor(() => expect((mockPrefs.homeLayout as any).order.indexOf('worth')).toBeLessThan((mockPrefs.homeLayout as any).order.indexOf('setup')));
    expect(within(screen.getByTestId('sheet')).getByText('Smart highlights')).toBeTruthy();
  });

  test('hiding every section explains how to get them back', async () => {
    mockPrefs.homeLayout = { order: [], hidden: ['insights', 'setup', 'worth', 'actions', 'month', 'attention', 'trend', 'categories', 'tiles'] };
    render(<HomeScreen go={go} />);
    await screen.findByText(/Every section is hidden/);
  });
});
