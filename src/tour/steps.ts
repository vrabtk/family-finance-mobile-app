// What the in-app guides say. Steps are defined once and reused: the complete tour is a walk through the
// whole app, and each screen's own guide is a short subset of the same steps.
import type { Route } from '../navigation';
import type { IconName } from '../ui';

export type Need = 'write' | 'admin'; // the step is only shown to people who can do what it explains

export type TourStep = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  route?: Route; // open this screen first
  target?: string; // id of a TourTarget to highlight (the card is simply centred when it cannot be found)
  need?: Need;
};

const home: Route = { tab: 'home' };
const expenses: Route = { tab: 'expenses' };
const more = (key: NonNullable<Route['more']>): Route => ({ tab: 'more', more: key });

const list: TourStep[] = [
  { id: 'welcome', icon: 'compass', route: home, title: 'Welcome to Family Finance',
    body: 'One place for your household money: expenses, salaries, loans, investments, insurance and bank balances, shared with the people you choose. This short tour shows where everything lives.' },
  { id: 'home.worth', icon: 'trending-up', route: home, target: 'home.worth', title: 'Your net worth',
    body: 'Bank balances plus investments, minus what you still owe. Tap the eye to hide the amount when someone is looking over your shoulder.' },
  { id: 'home.insights', icon: 'zap', route: home, target: 'home.insights', title: 'Smart highlights',
    body: 'This card reads your numbers and tells you what matters now: overspending, unpaid bills, premiums falling due, savings you can be proud of. It changes as your data does.' },
  { id: 'home.customize', icon: 'sliders', route: home, target: 'home.customize', title: 'Make the dashboard yours',
    body: 'Tap here to show, hide and reorder the dashboard sections. Keep only what you look at every day.' },
  { id: 'bar', icon: 'grid', route: home, target: 'bar', title: 'Your bottom bar',
    body: 'Home and More are always there. The three shortcuts in between are yours: pin the screens you use most from More, Customize bottom bar.' },
  { id: 'exp.periods', icon: 'calendar', route: expenses, target: 'exp.periods', title: 'Years and months',
    body: 'Money is tracked per month. Pick a year, then a month, or add a new one with the dashed Add chip. The sliders icon on top renames, archives and reorders them.' },
  { id: 'exp.summary', icon: 'pie-chart', route: expenses, target: 'exp.summary', title: 'The month at a glance',
    body: 'Income, spending and what is still unpaid for the selected month, with a progress bar of bills paid. The big number is what is left after expenses.' },
  { id: 'exp.views', icon: 'layers', route: expenses, target: 'exp.views', title: 'Bills, People, Other income',
    body: 'Bills lists what to pay (tap the circle to mark one paid). People holds each person\'s salary for the month. Other income is money that is not a salary.' },
  { id: 'exp.add', icon: 'plus-circle', route: expenses, target: 'fab', need: 'write', title: 'Add with the plus button',
    body: 'The round plus adds an expense (or a person, when you are on People). Pick a category from the list, or add your own right inside the form.' },
  { id: 'loans.intro', icon: 'percent', route: { tab: 'loans' }, title: 'Loans and EMIs',
    body: 'Home loans, cards, personal loans and money you lent out, with the outstanding amount and the monthly EMI. Filter by type with the chips on top.' },
  { id: 'loans.add', icon: 'plus-circle', route: { tab: 'loans' }, target: 'fab', need: 'write', title: 'Add a loan',
    body: 'Tap plus, choose or create a loan type, then enter the amount, EMI and rate. Your net worth and the EMI tile on Home update straight away.' },
  { id: 'banks.intro', icon: 'briefcase', route: { tab: 'banks' }, title: 'Bank balances',
    body: 'Create a bank, split it into sections (savings, FD, wallet) and keep a balance per entry. The total feeds your net worth.' },
  { id: 'banks.add', icon: 'plus-circle', route: { tab: 'banks' }, target: 'fab', need: 'write', title: 'Add a bank',
    body: 'Use plus to add a bank, then open it to add sections and entries. Update a balance whenever it changes.' },
  { id: 'inv.intro', icon: 'trending-up', route: more('investments'), title: 'Investments',
    body: 'Gold, deposits, shares, funds: what you put in, what it is worth now, and the gain. The gain percentage shows on Home.' },
  { id: 'inv.types', icon: 'edit-2', route: more('investments'), target: 'fab', need: 'write', title: 'Types are yours',
    body: 'There are no fixed investment types. In the form, tap Add or edit choices to create, rename or delete types (only unused ones can be deleted).' },
  { id: 'ins.intro', icon: 'shield', route: more('insurance'), title: 'Insurance',
    body: 'Policies with premium, frequency and next due date. Premiums due within 30 days appear under Needs your attention on Home.' },
  { id: 'ins.add', icon: 'plus-circle', route: more('insurance'), target: 'fab', need: 'write', title: 'Add a policy',
    body: 'Enter the premium and the next due date; the app reminds you on Home as it gets close.' },
  { id: 'ov.intro', icon: 'layers', route: more('overview'), title: 'Monthly overview',
    body: 'Your regular income, mandatory bills and savings in one list, turned into a monthly figure so you can see your real surplus.' },
  { id: 'ov.add', icon: 'plus-circle', route: more('overview'), target: 'fab', need: 'write', title: 'Add an item',
    body: 'Pick income, mandatory, savings or other, say how often it repeats (monthly, quarterly, yearly) and the amount.' },
  { id: 'an.intro', icon: 'bar-chart-2', route: more('analytics'), title: 'Analytics',
    body: 'Income against spending month by month, your savings rate, the best and worst months, totals per year and where the money goes.' },
  { id: 'an.range', icon: 'clock', route: more('analytics'), target: 'an.range', title: 'Choose the period',
    body: 'Switch between the last 6 months, 12 months or all time to see short-term habits or the long view.' },
  { id: 'ws.members', icon: 'users', route: more('settings'), target: 'ws.members', title: 'People in your workspace',
    body: 'Everyone sees the same data, based on their role: viewers read, members add and edit, admins also delete and manage people. Admins can change a role, block or remove someone by tapping them.' },
  { id: 'ws.invite', icon: 'user-plus', route: more('settings'), need: 'admin', title: 'Invite your family',
    body: 'Enter the email of someone who already created an account and choose their access. You can change it any time.' },
  { id: 'data.export', icon: 'download', route: more('data'), title: 'Back up your data',
    body: 'Export saves everything in this workspace as one file you can keep or send to yourself. It never includes passwords.' },
  { id: 'data.import', icon: 'upload', route: more('data'), need: 'admin', title: 'Restore or move data',
    body: 'Import adds the contents of an export file to this workspace, after showing you what is inside. Nothing is replaced, so importing twice adds twice.' },
  { id: 'tabs.pin', icon: 'sliders', route: more('tabs'), title: 'Pin your favourites',
    body: 'Unpin one of the three shortcuts, then pin another. Anything not pinned stays under More. Use the arrows to change the order.' },
  { id: 'profile.edit', icon: 'user', route: more('profile'), title: 'Your profile',
    body: 'Change your name and add an optional mobile number. Your email is your sign-in and stays as it is.' },
  { id: 'profile.password', icon: 'lock', route: more('profile'), title: 'Change your password',
    body: 'Enter your current password and a new one. Other devices are signed out for safety. Forgot it? Use Forgot password? on the sign-in screen: a code arrives by email.' },
  { id: 'help', icon: 'help-circle', target: 'help', title: 'Help is one tap away',
    body: 'Every screen has this question mark in its header. It replays that screen\'s guide. The full tour, and every guide, are also under More, App tour.' },
];

export const STEPS: Record<string, TourStep> = Object.fromEntries(list.map((s) => [s.id, s]));

export type TourId =
  | 'full' | 'home' | 'expenses' | 'loans' | 'banks' | 'investments' | 'insurance' | 'overview'
  | 'analytics' | 'settings' | 'profile' | 'data' | 'tabs';

export type Tour = { id: TourId; title: string; summary: string; icon: IconName; steps: string[] };

export const TOURS: Tour[] = [
  { id: 'full', title: 'Complete tour', summary: 'A walk through the whole app, screen by screen', icon: 'map',
    steps: ['welcome', 'home.worth', 'home.insights', 'home.customize', 'bar', 'exp.periods', 'exp.summary', 'exp.views', 'exp.add', 'loans.intro', 'banks.intro', 'inv.intro', 'ins.intro', 'ov.intro', 'an.intro', 'ws.members', 'data.export', 'tabs.pin', 'profile.edit', 'help'] },
  { id: 'home', title: 'Dashboard', summary: 'Net worth, highlights and how to customize', icon: 'home', steps: ['home.worth', 'home.insights', 'home.customize', 'bar'] },
  { id: 'expenses', title: 'Expenses', summary: 'Months, bills, people and income', icon: 'shopping-bag', steps: ['exp.periods', 'exp.summary', 'exp.views', 'exp.add'] },
  { id: 'loans', title: 'Loans', summary: 'EMIs, cards and money lent', icon: 'percent', steps: ['loans.intro', 'loans.add'] },
  { id: 'banks', title: 'Banks', summary: 'Accounts, sections and balances', icon: 'briefcase', steps: ['banks.intro', 'banks.add'] },
  { id: 'investments', title: 'Investments', summary: 'Holdings, value and your own types', icon: 'trending-up', steps: ['inv.intro', 'inv.types'] },
  { id: 'insurance', title: 'Insurance', summary: 'Policies and premium reminders', icon: 'shield', steps: ['ins.intro', 'ins.add'] },
  { id: 'overview', title: 'Monthly overview', summary: 'Regular income, bills and savings', icon: 'layers', steps: ['ov.intro', 'ov.add'] },
  { id: 'analytics', title: 'Analytics', summary: 'Trends, savings rate and categories', icon: 'bar-chart-2', steps: ['an.intro', 'an.range'] },
  { id: 'settings', title: 'Workspace and members', summary: 'Roles, blocking and invitations', icon: 'users', steps: ['ws.members', 'ws.invite'] },
  { id: 'profile', title: 'My profile', summary: 'Name, mobile number and password', icon: 'user', steps: ['profile.edit', 'profile.password'] },
  { id: 'data', title: 'Export and import', summary: 'Back up or restore your data', icon: 'download', steps: ['data.export', 'data.import'] },
  { id: 'tabs', title: 'Bottom bar', summary: 'Pin the screens you use most', icon: 'sliders', steps: ['tabs.pin'] },
];

export const tourById = (id: TourId): Tour => TOURS.find((t) => t.id === id)!;
