import { dateLabel, daysUntil, inr, inrCompact, toNumber } from '../format';
import { insuranceApi, investmentsApi, loansApi, overviewApi } from '../api';
import { capitalize } from '../options';
import { ResourceConfig, ResourceScreen } from './ResourceScreen';

const sum = (items: any[], key: string) => items.reduce((s, i) => s + toNumber(i[key]), 0);
const label = (options: Array<{ value: string; label: string }>, value?: string | null) => options.find((o) => o.value === value)?.label ?? value ?? '';
const join = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' · ');
const matchType = (item: any, value: string) => item.type === value;

// ── Loans ────────────────────────────────────────────────────────────────────
const loans: ResourceConfig = {
  title: 'Loans',
  noun: 'loan',
  icon: 'percent',
  emptyHint: 'Track home loans, credit cards, personal loans and money you have lent.',
  crud: loansApi,
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Home loan' },
    { key: 'type', label: 'Type', kind: 'option', optionKind: 'loanType', required: true },
    { key: 'who', label: 'Borrower / lender', kind: 'text' },
    { key: 'totalAmount', label: 'Total amount (₹)', kind: 'number' },
    { key: 'outstanding', label: 'Outstanding (₹)', kind: 'number' },
    { key: 'emi', label: 'Monthly EMI (₹)', kind: 'number' },
    { key: 'interestRate', label: 'Interest rate (%)', kind: 'number' },
    { key: 'startDate', label: 'Start date', kind: 'date' },
    { key: 'endDate', label: 'End date', kind: 'date' },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ],
  filter: { optionKind: 'loanType', match: matchType },
  summary: (items) => {
    const owed = items.filter((i) => i.type !== 'given');
    return [
      { label: 'Outstanding', value: inrCompact(sum(owed, 'outstanding')), tone: 'negative', icon: 'trending-down' },
      { label: 'Monthly EMI', value: inrCompact(sum(owed, 'emi')), tone: 'warning', icon: 'repeat' },
    ];
  },
  row: (l) => ({
    title: l.name,
    subtitle: join(capitalize(l.type), l.who, l.interestRate ? `${toNumber(l.interestRate)}%` : null),
    amount: inr(l.outstanding),
    badge: toNumber(l.emi) ? { label: `${inr(l.emi)}/mo`, tone: l.type === 'given' ? 'positive' : 'warning' } : undefined,
  }),
};

// ── Investments ──────────────────────────────────────────────────────────────
const investments: ResourceConfig = {
  title: 'Investments',
  noun: 'investment',
  icon: 'trending-up',
  emptyHint: 'Add gold, deposits, stocks and mutual funds to see your growth.',
  crud: investmentsApi,
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Family gold' },
    { key: 'type', label: 'Type', kind: 'option', optionKind: 'investmentType', required: true },
    { key: 'owner', label: 'Owner', kind: 'text' },
    { key: 'investedAmount', label: 'Invested (₹)', kind: 'number' },
    { key: 'currentValue', label: 'Current value (₹)', kind: 'number' },
    { key: 'quantity', label: 'Quantity', kind: 'number' },
    { key: 'rate', label: 'Rate / price (₹)', kind: 'number' },
    { key: 'startDate', label: 'Start date', kind: 'date' },
    { key: 'maturityDate', label: 'Maturity date', kind: 'date' },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ],
  filter: { optionKind: 'investmentType', match: matchType },
  summary: (items) => {
    const invested = sum(items, 'investedAmount');
    const current = sum(items, 'currentValue');
    const gain = current - invested;
    return [
      { label: 'Invested', value: inrCompact(invested), tone: 'info', icon: 'download' },
      { label: 'Current value', value: inrCompact(current), tone: 'primary', icon: 'bar-chart-2' },
      { label: gain >= 0 ? 'Gain' : 'Loss', value: inrCompact(Math.abs(gain)), tone: gain >= 0 ? 'positive' : 'negative', icon: gain >= 0 ? 'arrow-up-right' : 'arrow-down-right' },
    ];
  },
  row: (i) => {
    const invested = toNumber(i.investedAmount);
    const gain = toNumber(i.currentValue) - invested;
    const pct = invested > 0 ? (gain / invested) * 100 : null;
    return {
      title: i.name,
      subtitle: join(capitalize(i.type), i.owner, i.maturityDate ? `matures ${dateLabel(i.maturityDate)}` : null),
      amount: inr(i.currentValue ?? i.investedAmount),
      badge: pct === null ? undefined : { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, tone: pct >= 0 ? 'positive' : 'negative' },
    };
  },
};

// ── Insurance ────────────────────────────────────────────────────────────────
const INS_FREQ = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];
const PER_YEAR: Record<string, number> = { monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1 };

const insurance: ResourceConfig = {
  title: 'Insurance',
  noun: 'policy',
  icon: 'shield',
  emptyHint: 'Add your policies to see yearly premiums and upcoming due dates.',
  crud: insuranceApi,
  fields: [
    { key: 'name', label: 'Policy name', kind: 'text', required: true, placeholder: 'e.g. Family floater' },
    { key: 'type', label: 'Type', kind: 'option', optionKind: 'insuranceType', required: true },
    { key: 'insuredPerson', label: 'Insured person', kind: 'text' },
    { key: 'policyNumber', label: 'Policy number', kind: 'text' },
    { key: 'premiumAmount', label: 'Premium (₹)', kind: 'number' },
    { key: 'frequency', label: 'Premium frequency', kind: 'select', options: INS_FREQ, required: true, defaultValue: 'yearly' },
    { key: 'nextDueDate', label: 'Next due date', kind: 'date' },
    { key: 'sumAssured', label: 'Sum assured (₹)', kind: 'number' },
    { key: 'startDate', label: 'Start date', kind: 'date' },
    { key: 'endDate', label: 'End date', kind: 'date' },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ],
  filter: { optionKind: 'insuranceType', match: matchType },
  summary: (items) => [
    { label: 'Yearly premium', value: inrCompact(items.reduce((s, p) => s + toNumber(p.premiumAmount) * (PER_YEAR[p.frequency] ?? 1), 0)), tone: 'warning', icon: 'calendar' },
    { label: 'Total cover', value: inrCompact(sum(items, 'sumAssured')), tone: 'positive', icon: 'shield' },
  ],
  row: (p) => {
    const due = daysUntil(p.nextDueDate);
    const badge: { label: string; tone: 'negative' | 'warning' } | undefined =
      due === null ? undefined : due < 0 ? { label: 'Overdue', tone: 'negative' } : due <= 30 ? { label: `Due in ${due}d`, tone: 'warning' } : undefined;
    return {
      title: p.name,
      subtitle: join(capitalize(p.type), p.insuredPerson, p.nextDueDate ? `due ${dateLabel(p.nextDueDate)}` : null),
      amount: `${inr(p.premiumAmount)}`,
      badge,
    };
  },
};

// ── Monthly overview ─────────────────────────────────────────────────────────
const OV_CATEGORIES = [
  { value: 'income', label: 'Income' },
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
];
const OV_FREQ = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one-time', label: 'One-time' },
];
const MONTHS_IN_PERIOD: Record<string, number> = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12, 'one-time': 0 };
const toMonthly = (item: any) => {
  const months = MONTHS_IN_PERIOD[item.frequency] ?? 1;
  return months === 0 ? 0 : toNumber(item.amount) / months;
};
const OV_GROUP: Record<string, string> = { income: 'Income sources', mandatory: 'Mandatory expenses', savings: 'Savings & chit', other: 'Other expenses' };

const overview: ResourceConfig = {
  title: 'Overview',
  noun: 'item',
  icon: 'layers',
  emptyHint: 'List your regular income, bills and savings to see your monthly cash flow.',
  crud: overviewApi,
  fields: [
    { key: 'category', label: 'Category', kind: 'select', options: OV_CATEGORIES, required: true, defaultValue: 'income' },
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Salary, Rent' },
    { key: 'amount', label: 'Amount (₹)', kind: 'number', required: true },
    { key: 'frequency', label: 'How often', kind: 'select', options: OV_FREQ, required: true, defaultValue: 'monthly' },
    { key: 'who', label: 'Whose', kind: 'text' },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ],
  groupOrder: Object.values(OV_GROUP),
  summary: (items) => {
    const income = items.filter((i) => i.category === 'income').reduce((s, i) => s + toMonthly(i), 0);
    const out = items.filter((i) => i.category !== 'income').reduce((s, i) => s + toMonthly(i), 0);
    const net = income - out;
    return [
      { label: 'Income / month', value: inrCompact(income), tone: 'positive', icon: 'arrow-down-left' },
      { label: 'Outgoing / month', value: inrCompact(out), tone: 'negative', icon: 'arrow-up-right' },
      { label: net >= 0 ? 'Surplus' : 'Shortfall', value: inrCompact(Math.abs(net)), tone: net >= 0 ? 'primary' : 'warning', icon: 'pocket' },
    ];
  },
  row: (i) => ({
    title: i.name,
    subtitle: join(label(OV_FREQ, i.frequency), i.who),
    amount: inr(i.amount),
    group: OV_GROUP[i.category] ?? 'Other expenses',
  }),
};

export const LoansScreen = () => <ResourceScreen config={loans} />;
export const InvestmentsScreen = ({ onBack }: { onBack: () => void }) => <ResourceScreen config={investments} onBack={onBack} />;
export const InsuranceScreen = ({ onBack }: { onBack: () => void }) => <ResourceScreen config={insurance} onBack={onBack} />;
export const OverviewScreen = ({ onBack }: { onBack: () => void }) => <ResourceScreen config={overview} onBack={onBack} />;
