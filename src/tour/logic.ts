// Pure rules for the guided tours (no React, no storage).
import { STEPS, TOURS, TourId, TourStep, tourById } from './steps';

export type Access = 'viewer' | 'member' | 'admin';

// A step that explains an action is hidden from people who cannot do it.
export const canSee = (step: TourStep, access: Access): boolean =>
  !step.need || (step.need === 'write' ? access !== 'viewer' : access === 'admin');

export const stepsFor = (id: TourId, access: Access): TourStep[] =>
  tourById(id).steps.map((stepId) => STEPS[stepId]).filter((s) => canSee(s, access));

// Anything read from the device is checked: only known tour ids, once each.
export function cleanSeen(raw: unknown): TourId[] {
  const known = new Set<string>(TOURS.map((t) => t.id));
  return Array.isArray(raw) ? raw.filter((id, i, all): id is TourId => typeof id === 'string' && known.has(id) && all.indexOf(id) === i) : [];
}

export const markSeen = (seen: TourId[], id: TourId): TourId[] => (seen.includes(id) ? seen : [...seen, id]);

// The complete tour starts by itself once per device, after the saved choices have been read.
export const shouldAutoStart = (seen: TourId[], loaded: boolean): boolean => loaded && !seen.includes('full');

export const clampIndex = (index: number, total: number): number => Math.max(0, Math.min(index, Math.max(0, total - 1)));
export const isLast = (index: number, total: number): boolean => index >= total - 1;

// Where to draw the explanation card: below a target in the top half of the screen, above one in the bottom half,
// and in the middle when there is nothing to point at.
export type Rect = { x: number; y: number; width: number; height: number };
export function cardPlacement(rect: Rect | null, screenHeight: number): 'below' | 'above' | 'center' {
  if (!rect) return 'center';
  return rect.y + rect.height / 2 < screenHeight / 2 ? 'below' : 'above';
}

// A target counts only when it is really on screen; anything else falls back to the centred card.
export const usableRect = (r: Rect | null, screen: { width: number; height: number }): Rect | null =>
  r && r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= 0 && r.x + r.width <= screen.width + 1 && r.y + r.height <= screen.height + 1 ? r : null;
