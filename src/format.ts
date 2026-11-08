export const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ₹1,23,456 (Indian digit grouping). Prisma Decimals arrive as strings, so coerce first.
export const inr = (value: unknown): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(toNumber(value));

// ₹1.2L / ₹3.4Cr for tight spaces.
export const inrCompact = (value: unknown): string => {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.?0+$/, '')}L`;
  return inr(n);
};

// '2026-03-05T00:00:00.000Z' -> '5 Mar 2026'
export const dateLabel = (value: unknown): string => {
  if (!value || typeof value !== 'string') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

// API date -> value for a YYYY-MM-DD text field.
export const dateInput = (value: unknown): string => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '');

// Whole days from now until a date (negative = overdue); null when there is no valid date.
export const daysUntil = (value?: string | null, now: Date = new Date()): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - now.getTime()) / 86_400_000);
};
