// Which dashboard sections are shown, and in what order. Kept on the device; every value read back is checked.
import { moveId } from '../expenses/logic';

export type SectionId = 'insights' | 'setup' | 'worth' | 'actions' | 'month' | 'attention' | 'trend' | 'categories' | 'tiles';

export const HOME_SECTIONS: Array<{ id: SectionId; label: string; hint: string }> = [
  { id: 'insights', label: 'Smart highlights', hint: 'What needs attention or deserves a pat on the back' },
  { id: 'setup', label: 'Getting started', hint: 'A checklist until your household is set up' },
  { id: 'worth', label: 'Net worth', hint: 'Banks and investments minus loans' },
  { id: 'actions', label: 'Quick actions', hint: 'Shortcuts to the screens you open most' },
  { id: 'month', label: 'This month', hint: 'Income against spending' },
  { id: 'attention', label: 'Needs your attention', hint: 'Unpaid bills and premiums due' },
  { id: 'trend', label: 'Six-month trend', hint: 'Income and spending over time' },
  { id: 'categories', label: 'Spending by category', hint: 'Where this month\'s money went' },
  { id: 'tiles', label: 'Your money at a glance', hint: 'Banks, investments, EMIs, insurance' },
];

export type HomeLayout = { order: SectionId[]; hidden: SectionId[] };

const ALL = HOME_SECTIONS.map((s) => s.id);
export const DEFAULT_LAYOUT: HomeLayout = { order: ALL, hidden: [] };

const isSection = (v: unknown): v is SectionId => typeof v === 'string' && (ALL as string[]).includes(v);
const unique = <T,>(list: T[]) => list.filter((v, i) => list.indexOf(v) === i);

// Unknown or repeated entries are dropped; sections added by a newer app version are appended in their default place.
export function cleanLayout(raw: unknown): HomeLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { order?: unknown; hidden?: unknown };
  const saved = Array.isArray(r.order) ? unique(r.order.filter(isSection)) : [];
  const order = [...saved, ...ALL.filter((id) => !saved.includes(id))];
  const hidden = Array.isArray(r.hidden) ? unique(r.hidden.filter(isSection)) : [];
  return { order, hidden };
}

export const toggleSection = (layout: HomeLayout, id: SectionId): HomeLayout => ({
  ...layout,
  hidden: layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
});

export const moveSection = (layout: HomeLayout, id: SectionId, delta: -1 | 1): HomeLayout => ({
  ...layout,
  order: moveId(layout.order, id, delta) as SectionId[],
});

// What to draw, top to bottom.
export const visibleSections = (layout: HomeLayout): SectionId[] => layout.order.filter((id) => !layout.hidden.includes(id));
