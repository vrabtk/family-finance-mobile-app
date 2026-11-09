import type { IconName } from './ui';

export type TabKey = 'home' | 'expenses' | 'loans' | 'banks' | 'more';
export type MoreKey = 'investments' | 'insurance' | 'overview' | 'settings' | 'profile' | 'tabs';

// Every screen except Home and More can be pinned to the bottom bar; the rest are listed under More.
export type PinKey = 'expenses' | 'loans' | 'banks' | 'investments' | 'insurance' | 'overview' | 'settings';
export type Route = { tab: TabKey; more?: MoreKey };

export const PINNABLE: Array<{ key: PinKey; label: string; hint: string; icon: IconName; route: Route }> = [
  { key: 'expenses', label: 'Expenses', hint: 'Months, salaries and bills', icon: 'shopping-bag', route: { tab: 'expenses' } },
  { key: 'loans', label: 'Loans', hint: 'EMIs, cards and money lent', icon: 'percent', route: { tab: 'loans' } },
  { key: 'banks', label: 'Banks', hint: 'Accounts and balances', icon: 'briefcase', route: { tab: 'banks' } },
  { key: 'investments', label: 'Investments', hint: 'Gold, deposits, stocks, funds', icon: 'trending-up', route: { tab: 'more', more: 'investments' } },
  { key: 'insurance', label: 'Insurance', hint: 'Policies, premiums, due dates', icon: 'shield', route: { tab: 'more', more: 'insurance' } },
  { key: 'overview', label: 'Monthly overview', hint: 'Income, bills and savings', icon: 'layers', route: { tab: 'more', more: 'overview' } },
  { key: 'settings', label: 'Workspace & members', hint: 'Switch workspace, invite people', icon: 'users', route: { tab: 'more', more: 'settings' } },
];

export const PIN_SLOTS = 3;
export const DEFAULT_PINS: PinKey[] = ['expenses', 'loans', 'banks'];

export const pinInfo = (key: PinKey) => PINNABLE.find((p) => p.key === key)!;

// Anything stored on the device is checked: unknown or repeated keys are dropped, then the defaults fill the empty slots.
export function cleanPins(raw: unknown): PinKey[] {
  const known = new Set<string>(PINNABLE.map((p) => p.key));
  const picked = Array.isArray(raw) ? raw.filter((k, i, all): k is PinKey => typeof k === 'string' && known.has(k) && all.indexOf(k) === i) : [];
  const pins = picked.slice(0, PIN_SLOTS);
  for (const d of DEFAULT_PINS) if (pins.length < PIN_SLOTS && !pins.includes(d)) pins.push(d);
  return pins;
}

// Pin or unpin. Pinning needs a free slot (unpin something first); at least one pin is not required.
export function togglePin(pins: PinKey[], key: PinKey): PinKey[] {
  if (pins.includes(key)) return pins.filter((k) => k !== key);
  return pins.length >= PIN_SLOTS ? pins : [...pins, key];
}

export function movePin(pins: PinKey[], key: PinKey, delta: -1 | 1): PinKey[] {
  const from = pins.indexOf(key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= pins.length) return pins;
  const next = [...pins];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

// The bottom bar: Home, the pinned screens in order, then More.
export type BarItem = { key: string; label: string; icon: IconName; route: Route };
export const barItems = (pins: PinKey[]): BarItem[] => [
  { key: 'home', label: 'Home', icon: 'home', route: { tab: 'home' } },
  ...pins.map((k) => { const p = pinInfo(k); return { key: p.key, label: p.label, icon: p.icon, route: p.route }; }),
  { key: 'more', label: 'More', icon: 'grid', route: { tab: 'more' } },
];

const same = (a: Route, b: Route) => a.tab === b.tab && (a.more ?? null) === (b.more ?? null);
// Which bar item is highlighted: the one matching the current screen; More for any other screen reached through it.
export function activeBarKey(pins: PinKey[], current: Route): string {
  const hit = barItems(pins).find((i) => i.key !== 'more' && same(i.route, current));
  return hit ? hit.key : current.tab === 'home' ? 'home' : 'more';
}

// A specific year/month to open Expenses on (used when Home sends you to "this month's unpaid bills").
export type Focus = { yearId: string; groupId: string | null };

export type GoOptions = { more?: MoreKey; focus?: Focus };
export type Go = (tab: TabKey, options?: GoOptions) => void;
