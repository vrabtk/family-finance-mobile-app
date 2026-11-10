// The "Getting started" checklist on Home. Each step is ticked from the data the household already has,
// so it never needs to be saved or dismissed: it simply disappears once everything is done.
import { toNumber } from '../format';
import type { Route } from '../navigation';
import type { HomeData } from './useHome';

export type SetupStep = { id: string; label: string; hint: string; done: boolean; route: Route };

export function setupSteps(data: Pick<HomeData, 'all' | 'banks' | 'policies' | 'periods' | 'expenses'>): SetupStep[] {
  const hasMonth = data.periods.length > 0;
  const hasIncome = data.periods.some((p) => toNumber(p.totalIncome) > 0);
  const hasExpense = toNumber(data.all?.expenseCount) > 0 || (data.expenses?.length ?? 0) > 0;
  return [
    { id: 'month', label: 'Add a year and a month', hint: 'Money is tracked per month', done: hasMonth, route: { tab: 'expenses' } },
    { id: 'income', label: 'Add people and salaries', hint: 'So we can show what is left', done: hasIncome, route: { tab: 'expenses' } },
    { id: 'expense', label: 'Add your first expense', hint: 'Rent, groceries, a bill', done: hasExpense, route: { tab: 'expenses' } },
    { id: 'bank', label: 'Add a bank account', hint: 'Feeds your net worth', done: (data.banks?.length ?? 0) > 0, route: { tab: 'banks' } },
    { id: 'debt', label: 'Add a loan or investment', hint: 'Complete the money picture', done: toNumber(data.all?.totalDebt) > 0 || toNumber(data.all?.totalInvested) > 0, route: { tab: 'loans' } },
    { id: 'insurance', label: 'Add an insurance policy', hint: 'Get premium reminders', done: (data.policies?.length ?? 0) > 0, route: { tab: 'more', more: 'insurance' } },
  ];
}

export const setupProgress = (steps: SetupStep[]) => ({ done: steps.filter((s) => s.done).length, total: steps.length });
export const setupComplete = (steps: SetupStep[]) => steps.every((s) => s.done);
