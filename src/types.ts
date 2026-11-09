export type Role = 'viewer' | 'member' | 'admin';

export type OptionKind = 'expenseCategory' | 'loanType' | 'investmentType' | 'insuranceType';
export type OptionItem = { id: string; name: string; sortOrder: number };
export type OptionLists = Record<OptionKind, OptionItem[]>;

export type Member = {
  userId: string; name: string; email: string; role: Role; blocked: boolean; joinedAt: string; isOwner: boolean;
};

export type Workspace = {
  id: string;
  name: string;
  type: string;
  role?: Role;
  memberCount?: number;
};

export type MobileSession = {
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
  };
  accessToken: string;
  refreshToken: string;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
};

export type Person = { id: string; name: string; color?: string | null; baseSalary?: string | number; hasPanel?: boolean };
export type ExpenseGroup = { id: string; label: string; status?: string; salaryEntries?: SalaryEntry[] };
export type SalaryEntry = { id: string; personId: string; yearId?: string | null; groupId?: string | null; amount: string | number };
export type ExpenseYear = { id: string; label: string; hasSubgroups: boolean; status?: string; groups?: ExpenseGroup[] };
export type Expense = {
  id: string;
  label: string;
  amount: string | number;
  status: 'pending' | 'done' | string;
  category?: string | null;
  personId?: string | null;
  yearId?: string | null;
  groupId?: string | null;
  notes?: string | null;
  isArchived?: boolean;
};

export type Analytics = {
  totalExpenses: number;
  expenseCount: number;
  totalDebt: number;
  monthlyEmi: number;
  totalInvested: number;
  currentValue: number;
  investmentGain: number;
  topCategories: Array<{ name: string; total: number }>;
};

export type BankEntry = { id: string; label: string; amount: string | number; notes?: string | null };
export type BankSection = { id: string; name: string; entries: BankEntry[] };
export type Bank = { id: string; name: string; sections: BankSection[] };

export type AnalyticsPeriod = {
  yearId: string;
  yearLabel: string;
  groupId: string | null;
  label: string; // month label, or the year label for flat years
  totalIncome: number;
  totalExpenses: number;
  surplus: number;
};
