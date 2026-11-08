import type { IconName } from './ui';

export type TabKey = 'home' | 'expenses' | 'loans' | 'banks' | 'more';
export type MoreKey = 'investments' | 'insurance' | 'overview' | 'settings';

export const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'expenses', label: 'Expenses', icon: 'shopping-bag' },
  { key: 'loans', label: 'Loans', icon: 'percent' },
  { key: 'banks', label: 'Banks', icon: 'briefcase' },
  { key: 'more', label: 'More', icon: 'grid' },
];

// A specific year/month to open Expenses on (used when Home sends you to "this month's unpaid bills").
export type Focus = { yearId: string; groupId: string | null };

export type GoOptions = { more?: MoreKey; focus?: Focus };
export type Go = (tab: TabKey, options?: GoOptions) => void;
