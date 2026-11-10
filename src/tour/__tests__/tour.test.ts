import { PINNABLE } from '../../navigation';
import { cardPlacement, cleanSeen, clampIndex, isLast, markSeen, shouldAutoStart, stepsFor, usableRect } from '../logic';
import { STEPS, TOURS } from '../steps';

describe('tour content', () => {
  test('every tour step exists, and no tour repeats a step or an id', () => {
    for (const t of TOURS) {
      expect(new Set(t.steps).size).toBe(t.steps.length);
      for (const id of t.steps) expect(STEPS[id]).toBeDefined();
    }
    expect(new Set(TOURS.map((t) => t.id)).size).toBe(TOURS.length);
  });

  test('every step has a title and an explanation, and routes point at real screens', () => {
    const more = new Set(['investments', 'insurance', 'overview', 'settings', 'profile', 'tabs', 'data', 'analytics']);
    const tabs = new Set(['home', 'expenses', 'loans', 'banks', 'more']);
    for (const s of Object.values(STEPS)) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.body.length).toBeGreaterThan(30);
      if (s.route) {
        expect(tabs.has(s.route.tab)).toBe(true);
        if (s.route.more) expect(more.has(s.route.more)).toBe(true);
      }
    }
  });

  test('every pinnable screen has its own guide', () => {
    const ids = new Set<string>(TOURS.map((t) => t.id));
    for (const p of PINNABLE) expect(ids.has(p.key)).toBe(true);
    for (const id of ['home', 'profile', 'data', 'tabs']) expect(ids.has(id)).toBe(true);
  });

  test('every step is used by some tour, and the complete tour covers every screen', () => {
    const used = new Set(TOURS.flatMap((t) => t.steps));
    expect(Object.keys(STEPS).filter((id) => !used.has(id))).toEqual([]);
    const full = TOURS.find((t) => t.id === 'full')!;
    const places = new Set(full.steps.map((id) => STEPS[id].route?.more ?? STEPS[id].route?.tab));
    for (const r of ['home', 'expenses', 'loans', 'banks', 'investments', 'insurance', 'overview', 'analytics', 'settings', 'data', 'tabs', 'profile']) expect(places.has(r as never)).toBe(true);
  });
});

describe('stepsFor', () => {
  test('viewers do not see steps about adding or managing', () => {
    expect(stepsFor('full', 'viewer').map((s) => s.id)).not.toContain('exp.add');
    expect(stepsFor('expenses', 'viewer').map((s) => s.id)).toEqual(['exp.periods', 'exp.summary', 'exp.views']);
  });
  test('members see add steps but not admin-only ones; admins see everything', () => {
    expect(stepsFor('expenses', 'member').map((s) => s.id)).toContain('exp.add');
    expect(stepsFor('settings', 'member').map((s) => s.id)).toEqual(['ws.members']);
    expect(stepsFor('settings', 'admin').map((s) => s.id)).toEqual(['ws.members', 'ws.invite']);
    expect(stepsFor('data', 'admin')).toHaveLength(2);
  });
  test('no guide is ever empty, whatever the role', () => {
    for (const t of TOURS) for (const a of ['viewer', 'member', 'admin'] as const) expect(stepsFor(t.id, a).length).toBeGreaterThan(0);
  });
});

describe('saved state and indexes', () => {
  test('cleanSeen keeps known ids once and ignores garbage', () => {
    expect(cleanSeen(['full', 'home', 'full', 'nope', 3])).toEqual(['full', 'home']);
    expect(cleanSeen(undefined)).toEqual([]);
    expect(cleanSeen('full')).toEqual([]);
  });
  test('markSeen adds once', () => {
    expect(markSeen([], 'full')).toEqual(['full']);
    expect(markSeen(['full'], 'full')).toEqual(['full']);
  });
  test('the complete tour starts by itself once, and only after the saved state is read', () => {
    expect(shouldAutoStart([], false)).toBe(false);
    expect(shouldAutoStart([], true)).toBe(true);
    expect(shouldAutoStart(['full'], true)).toBe(false);
    expect(shouldAutoStart(['home'], true)).toBe(true);
  });
  test('clampIndex and isLast', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2, 0)).toBe(0);
    expect(isLast(4, 5)).toBe(true);
    expect(isLast(3, 5)).toBe(false);
  });
});

describe('placement', () => {
  const screen = { width: 400, height: 800 };
  test('card goes below a high target, above a low one, centre when nothing to point at', () => {
    expect(cardPlacement({ x: 10, y: 100, width: 100, height: 50 }, 800)).toBe('below');
    expect(cardPlacement({ x: 10, y: 600, width: 100, height: 50 }, 800)).toBe('above');
    expect(cardPlacement(null, 800)).toBe('center');
  });
  test('usableRect rejects empty or off-screen targets', () => {
    expect(usableRect({ x: 10, y: 10, width: 100, height: 40 }, screen)).not.toBeNull();
    expect(usableRect({ x: 10, y: 10, width: 0, height: 40 }, screen)).toBeNull();
    expect(usableRect({ x: 10, y: 790, width: 100, height: 60 }, screen)).toBeNull();
    expect(usableRect({ x: 350, y: 10, width: 100, height: 40 }, screen)).toBeNull();
    expect(usableRect(null, screen)).toBeNull();
  });
});
