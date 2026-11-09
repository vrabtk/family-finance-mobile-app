import { fireEvent, render, screen } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { AnalyticsScreen } from '../AnalyticsScreen';

jest.mock('../../api');
jest.mock('../../session', () => ({
  useSession: () => ({ workspace: { id: 'w1' } }),
  errorMessage: (e: any, f = 'Something went wrong.') => e?.message || f,
}));

jest.setTimeout(20000);
const api = jest.mocked(apiModule) as any;
const period = (n: number, yearLabel: string, income: number, spend: number) =>
  ({ yearId: yearLabel, yearLabel, groupId: `g${n}`, label: `M${n}-${yearLabel}`, totalIncome: income, totalExpenses: spend, surplus: income - spend });
const all = { totalExpenses: 5000, expenseCount: 9, totalDebt: 120000, monthlyEmi: 8000, totalInvested: 50000, currentValue: 56000, investmentGain: 6000, topCategories: [{ name: 'food', total: 3000 }, { name: 'rent', total: 1000 }] };

beforeEach(() => {
  jest.clearAllMocks();
  api.getAnalyticsAllTime.mockResolvedValue(all);
  api.getAnalyticsMonthly.mockResolvedValue([period(1, '2025', 1000, 400), period(2, '2025', 1000, 1200), period(3, '2026', 2000, 500)]);
});

test('shows totals, savings rate, years, categories and the investment and loan snapshot', async () => {
  render(<AnalyticsScreen />);
  await screen.findByText('Savings rate');
  expect(screen.getByText('48%')).toBeTruthy();           // (4000 - 2100) / 4000
  expect(screen.getByText('2025')).toBeTruthy();
  expect(screen.getByText('2026')).toBeTruthy();
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('75%')).toBeTruthy();           // food share of the top categories
  expect(screen.getByText('Loans outstanding')).toBeTruthy();
  expect(screen.getByText('Highest spending')).toBeTruthy();
});

test('the range chips narrow the window', async () => {
  render(<AnalyticsScreen />);
  await screen.findByText('Savings rate');
  expect(screen.getByText(/over 3 months/)).toBeTruthy();
  fireEvent.press(screen.getByText('6 months'));
  expect(screen.getByText(/over 3 months/)).toBeTruthy(); // only three periods exist
});

test('an empty workspace explains what to do', async () => {
  api.getAnalyticsMonthly.mockResolvedValue([]);
  render(<AnalyticsScreen />);
  await screen.findByText('Nothing to analyse yet');
});

test('a failed load shows the error with retry', async () => {
  api.getAnalyticsAllTime.mockRejectedValueOnce(new Error('Server down'));
  render(<AnalyticsScreen />);
  await screen.findByText('Server down');
  fireEvent.press(screen.getByText('Retry'));
  await screen.findByText('Savings rate');
});
