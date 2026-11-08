// Loads everything the Home dashboard needs. Sections load independently: one failing call
// leaves its section empty instead of blanking the whole screen.
import { getAnalyticsAllTime, getAnalyticsMonthly, getExpenses } from '../api';
import * as api from '../api';
import { useAsync } from '../hooks';
import { useSession } from '../session';
import type { Analytics, AnalyticsPeriod, Bank, Expense } from '../types';
import { pickCurrentPeriod, trendWindow } from './logic';

export type Policy = { id: string; name: string; premiumAmount?: unknown; nextDueDate?: string | null; isArchived?: boolean };

export type HomeData = {
  all: Analytics | null;
  banks: Bank[] | null;
  policies: Policy[] | null;
  periods: AnalyticsPeriod[];
  current: AnalyticsPeriod | null;
  trend: AnalyticsPeriod[];
  expenses: Expense[] | null; // the current period's expenses
  failed: number; // how many of the sections could not be loaded
};

const settled = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

export function useHome() {
  const { workspace } = useSession();
  const wid = workspace?.id ?? '';

  return useAsync(async (): Promise<HomeData> => {
    const results = await Promise.allSettled([
      getAnalyticsAllTime(wid),
      getAnalyticsMonthly(wid),
      api.banksApi.list(wid),
      api.insuranceApi.list(wid),
    ] as const);
    const [allR, monthlyR, banksR, policiesR] = results;

    // Nothing loaded at all: let the screen show one clear error with Retry.
    if (results.every((r) => r.status === 'rejected')) throw (allR as PromiseRejectedResult).reason;

    const periods = settled(monthlyR) ?? [];
    const current = pickCurrentPeriod(periods);
    let expenses: Expense[] | null = null;
    let expensesFailed = false;
    if (current) {
      try { expenses = await getExpenses(wid, current.yearId, current.groupId); } catch { expensesFailed = true; }
    }

    return {
      all: settled(allR),
      banks: settled(banksR),
      policies: settled(policiesR) as Policy[] | null,
      periods,
      current,
      trend: trendWindow(periods, current),
      expenses,
      failed: results.filter((r) => r.status === 'rejected').length + (expensesFailed ? 1 : 0),
    };
  }, [wid]);
}
