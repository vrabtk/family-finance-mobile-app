import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { HomeScreen } from '../HomeScreen';

jest.mock('../../api');
jest.mock('../../session', () => ({
  useSession: () => ({ session: { user: { name: 'Hari Krishna' } }, workspace: { id: 'w1', name: 'Family' } }),
  errorMessage: (e: any, fallback = 'Something went wrong.') => e?.message || fallback,
}));

const api = jest.mocked(apiModule) as any;
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// Period labels avoid month names on purpose, so "the current period" never depends on today's date:
// the latest period with activity (Q3) is always chosen.
const periods = [
  { yearId: 'y1', yearLabel: '2026', groupId: 'g1', label: 'Q1', totalIncome: 90000, totalExpenses: 60000, surplus: 30000 },
  { yearId: 'y1', yearLabel: '2026', groupId: 'g2', label: 'Q2', totalIncome: 95000, totalExpenses: 80000, surplus: 15000 },
  { yearId: 'y1', yearLabel: '2026', groupId: 'g3', label: 'Q3', totalIncome: 100000, totalExpenses: 40000, surplus: 60000 },
  { yearId: 'y1', yearLabel: '2026', groupId: 'g4', label: 'Q4', totalIncome: 0, totalExpenses: 0, surplus: 0 },
];
const allTime = { totalExpenses: 500000, expenseCount: 60, totalDebt: 450000, monthlyEmi: 38500, totalInvested: 640000, currentValue: 712000, investmentGain: 72000, topCategories: [] };
const banks = [{ id: 'b1', name: 'HDFC', sections: [{ id: 's1', name: 'Savings', entries: [{ id: 'e1', label: 'A', amount: '100000' }, { id: 'e2', label: 'B', amount: 50000 }] }] }];
const expenses = [
  { id: 'x1', label: 'House rent', amount: '25000', status: 'done', category: 'housing', isArchived: false },
  { id: 'x2', label: 'School fees', amount: '12000', status: 'pending', category: 'education', isArchived: false },
  { id: 'x3', label: 'Electricity', amount: '2150', status: 'pending', category: 'utilities', isArchived: false },
  { id: 'x4', label: 'Rent received', amount: '9000', status: 'done', category: '__other_income__', isArchived: false },
];
const policies = [{ id: 'p1', name: 'Star Health', premiumAmount: '28000', nextDueDate: day(5) }, { id: 'p2', name: 'Term plan', premiumAmount: '9000', nextDueDate: day(200) }];

const go = jest.fn();
const open = async () => { render(<HomeScreen go={go} />); await screen.findByLabelText('₹4,12,000'); };

beforeEach(() => {
  api.getAnalyticsAllTime.mockResolvedValue(allTime);
  api.getAnalyticsMonthly.mockResolvedValue(periods);
  api.banksApi.list.mockResolvedValue(banks);
  api.insuranceApi.list.mockResolvedValue(policies);
  api.getExpenses.mockResolvedValue(expenses);
});

describe('what the dashboard shows', () => {
  test('greets the user by first name', async () => {
    await open();
    expect(screen.getByText(/^Good (morning|afternoon|evening|night), Hari$/)).toBeTruthy();
    expect(screen.getByText('Family')).toBeTruthy();
  });

  test('shows a loading skeleton first', async () => {
    render(<HomeScreen go={go} />);
    expect(screen.getByLabelText('Loading your dashboard')).toBeTruthy();
    await screen.findByLabelText('₹4,12,000');
    expect(screen.queryByLabelText('Loading your dashboard')).toBeNull();
  });

  test('net worth is banks + investments - debt, with each part shown', async () => {
    await open();                                     // 1,50,000 + 7,12,000 - 4,50,000
    // banks and investments also appear in their glance tiles; debt's tile text is longer ("₹4.5L outstanding")
    expect(screen.getAllByText('₹1.5L')).toHaveLength(2);
    expect(screen.getAllByText('₹7.12L')).toHaveLength(2);
    expect(screen.getAllByText('₹4.5L')).toHaveLength(1);
  });

  test('this month card picks the latest active period and shows its figures', async () => {
    await open();
    expect(screen.getByText('Q3 · 2026')).toBeTruthy();
    expect(screen.getByText('On track')).toBeTruthy();         // 40% of income spent
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByLabelText('₹60,000')).toBeTruthy();     // left to spend
    expect(screen.getByText('Left to spend')).toBeTruthy();
    expect(api.getExpenses).toHaveBeenCalledWith('w1', 'y1', 'g3');
  });

  test('over budget and watch states', async () => {
    api.getAnalyticsMonthly.mockResolvedValue([{ ...periods[2], totalIncome: 30000, totalExpenses: 45000 }]);
    await open();
    expect(screen.getByText('Over budget')).toBeTruthy();
    expect(screen.getByText('Over by')).toBeTruthy();
    expect(screen.getByLabelText('₹15,000')).toBeTruthy();
  });

  test('unpaid bills are counted and totalled (paid items and income are not)', async () => {
    await open();
    expect(screen.getByText('2 unpaid bills · ₹14,150 still to pay')).toBeTruthy();
  });

  test('the trend chart shows every period up to the current one, oldest first', async () => {
    await open();
    expect(screen.getByLabelText('Q1: income ₹90,000, spent ₹60,000')).toBeTruthy();
    expect(screen.getByLabelText('Q3: income ₹1,00,000, spent ₹40,000')).toBeTruthy();
    expect(screen.queryByLabelText(/^Q4:/)).toBeNull();        // after the current period
  });

  test('a single period shows a hint instead of a chart', async () => {
    api.getAnalyticsMonthly.mockResolvedValue([periods[2]]);
    await open();
    expect(screen.getByText('Add a second month to see how your income and spending move over time.')).toBeTruthy();
  });

  test('spending by category with shares, other income excluded', async () => {
    await open();
    expect(screen.getByText('Housing')).toBeTruthy();
    expect(screen.getByText('64%')).toBeTruthy();              // 25,000 of 39,150
    expect(screen.getByText('Education')).toBeTruthy();
    expect(screen.queryByText('Other_income__')).toBeNull();
  });

  test('needs-attention lists insurance first, then the biggest unpaid bills', async () => {
    await open();
    expect(screen.getByLabelText('Star Health premium. Due in 5 days')).toBeTruthy();
    expect(screen.getByLabelText('School fees. Unpaid this month')).toBeTruthy();
    expect(screen.getByLabelText('Electricity. Unpaid this month')).toBeTruthy();
    expect(screen.queryByLabelText(/Term plan/)).toBeNull();   // due in 200 days
    expect(screen.queryByLabelText(/House rent/)).toBeNull();  // already paid
  });

  test('when nothing needs attention it says so', async () => {
    api.getExpenses.mockResolvedValue([expenses[0]]);
    api.insuranceApi.list.mockResolvedValue([]);
    await open();
    expect(screen.getByText("You're all caught up")).toBeTruthy();
  });

  test('glance tiles: banks, investments with gain, EMIs, insurance', async () => {
    await open();
    expect(screen.getByLabelText('Bank balance ₹1.5L')).toBeTruthy();
    expect(screen.getByText('1 bank')).toBeTruthy();
    expect(screen.getByLabelText('Investments ₹7.12L')).toBeTruthy();
    expect(screen.getByText('+11.3% overall')).toBeTruthy();
    expect(screen.getByLabelText('Loan EMIs ₹38,500/mo')).toBeTruthy();
    expect(screen.getByText('₹4.5L outstanding')).toBeTruthy();
    expect(screen.getByLabelText('Insurance 2 policies')).toBeTruthy();
    expect(screen.getByText('Next premium in 5d')).toBeTruthy();
  });

  test('a loss is shown with a minus and no plus sign', async () => {
    api.getAnalyticsAllTime.mockResolvedValue({ ...allTime, totalInvested: 800000, currentValue: 712000, investmentGain: -88000 });
    render(<HomeScreen go={go} />);
    await screen.findByText('-11.0% overall');
  });
});

describe('navigation', () => {
  test('quick actions', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Add expense'));
    expect(go).toHaveBeenLastCalledWith('expenses', { focus: { yearId: 'y1', groupId: 'g3' } });
    fireEvent.press(screen.getByLabelText('Banks'));
    expect(go).toHaveBeenLastCalledWith('banks');
    fireEvent.press(screen.getByLabelText('Loans'));
    expect(go).toHaveBeenLastCalledWith('loans');
    fireEvent.press(screen.getByLabelText('Insurance'));
    expect(go).toHaveBeenLastCalledWith('more', { more: 'insurance' });
  });

  test('the month card opens Expenses on that exact month', async () => {
    await open();
    fireEvent.press(screen.getByText('Q3 · 2026'));
    expect(go).toHaveBeenLastCalledWith('expenses', { focus: { yearId: 'y1', groupId: 'g3' } });
  });

  test('attention rows open insurance or the month with the unpaid bill', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Star Health premium. Due in 5 days'));
    expect(go).toHaveBeenLastCalledWith('more', { more: 'insurance' });
    fireEvent.press(screen.getByLabelText('School fees. Unpaid this month'));
    expect(go).toHaveBeenLastCalledWith('expenses', { focus: { yearId: 'y1', groupId: 'g3' } });
  });

  test('glance tiles open their screens', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Bank balance ₹1.5L'));
    expect(go).toHaveBeenLastCalledWith('banks');
    fireEvent.press(screen.getByLabelText('Investments ₹7.12L'));
    expect(go).toHaveBeenLastCalledWith('more', { more: 'investments' });
    fireEvent.press(screen.getByLabelText('Loan EMIs ₹38,500/mo'));
    expect(go).toHaveBeenLastCalledWith('loans');
  });

  test('the avatar opens profile and settings', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Open profile and settings'));
    expect(go).toHaveBeenLastCalledWith('more');
  });
});

describe('privacy toggle', () => {
  test('hide and show the net worth card', async () => {
    await open();
    fireEvent.press(screen.getByLabelText('Hide net worth'));
    expect(screen.getByLabelText('Net worth hidden')).toBeTruthy();
    expect(screen.queryByLabelText('₹4,12,000')).toBeNull();
    expect(screen.getAllByText('••••')).toHaveLength(3);        // banks, investments, debt in the hero
    expect(screen.getAllByText('₹1.5L')).toHaveLength(1);       // only the glance tile is left
    fireEvent.press(screen.getByLabelText('Show net worth'));
    expect(screen.getByLabelText('₹4,12,000')).toBeTruthy();
    expect(screen.getAllByText('₹1.5L')).toHaveLength(2);
  });
});

describe('failures and empty states', () => {
  test('one section failing still shows the rest, with a notice', async () => {
    api.banksApi.list.mockRejectedValue(new Error('banks down'));
    render(<HomeScreen go={go} />);
    await screen.findByText('Some sections could not be loaded. Pull down to refresh.');
    expect(screen.getByText('Q3 · 2026')).toBeTruthy();
    expect(screen.getByLabelText('₹2,62,000')).toBeTruthy();   // banks are missing, so 7,12,000 - 4,50,000
  });

  test('the monthly call failing hides month sections but keeps net worth', async () => {
    api.getAnalyticsMonthly.mockRejectedValue(new Error('nope'));
    render(<HomeScreen go={go} />);
    await screen.findByText('Some sections could not be loaded. Pull down to refresh.');
    expect(screen.queryByText('Q3 · 2026')).toBeNull();
    expect(screen.getByLabelText('₹4,12,000')).toBeTruthy();
    expect(api.getExpenses).not.toHaveBeenCalled();
  });

  test('the current period expenses failing is reported but does not blank the screen', async () => {
    api.getExpenses.mockRejectedValue(new Error('slow'));
    render(<HomeScreen go={go} />);
    await screen.findByText('Some sections could not be loaded. Pull down to refresh.');
    expect(screen.getByText('Q3 · 2026')).toBeTruthy();
  });

  test('everything failing shows the error with a working Retry', async () => {
    for (const fn of [api.getAnalyticsAllTime, api.getAnalyticsMonthly, api.banksApi.list, api.insuranceApi.list]) fn.mockRejectedValueOnce(new Error('Server down'));
    render(<HomeScreen go={go} />);
    await screen.findByText('Server down');
    fireEvent.press(screen.getByText('Retry'));
    await screen.findByLabelText('₹4,12,000');
  });

  test('a brand-new workspace gets a friendly start instead of empty charts', async () => {
    api.getAnalyticsAllTime.mockResolvedValue({ ...allTime, totalDebt: 0, totalInvested: 0, currentValue: 0, investmentGain: 0, monthlyEmi: 0 });
    api.getAnalyticsMonthly.mockResolvedValue([]);
    api.banksApi.list.mockResolvedValue([]);
    api.insuranceApi.list.mockResolvedValue([]);
    render(<HomeScreen go={go} />);
    await screen.findByText("Let's set up your household");
    expect(screen.queryByText('NET WORTH')).toBeNull();
    fireEvent.press(screen.getByText('Start with expenses'));
    expect(go).toHaveBeenLastCalledWith('expenses');
  });

  test('a workspace with only banks is not treated as new', async () => {
    api.getAnalyticsAllTime.mockResolvedValue({ ...allTime, totalDebt: 0, totalInvested: 0, currentValue: 0, investmentGain: 0 });
    api.getAnalyticsMonthly.mockResolvedValue([]);
    api.insuranceApi.list.mockResolvedValue([]);
    render(<HomeScreen go={go} />);
    await screen.findByLabelText('₹1,50,000');   // net worth is just the bank balance
    expect(screen.queryByText("Let's set up your household")).toBeNull();
    await waitFor(() => expect(screen.queryByText('This month')).toBeNull());
  });
});
