import { DEFAULT_PINS, PIN_SLOTS, activeBarKey, barItems, cleanPins, movePin, togglePin } from '../navigation';

describe('cleanPins', () => {
  test('keeps valid saved pins in order', () => {
    expect(cleanPins(['insurance', 'banks', 'overview'])).toEqual(['insurance', 'banks', 'overview']);
  });
  test('drops unknown and repeated keys, then fills from the defaults', () => {
    expect(cleanPins(['nope', 'banks', 'banks', 7])).toEqual(['banks', 'expenses', 'loans']);
  });
  test('garbage or nothing gives the defaults; never more than the slots', () => {
    expect(cleanPins(undefined)).toEqual(DEFAULT_PINS);
    expect(cleanPins('x')).toEqual(DEFAULT_PINS);
    expect(cleanPins(['expenses', 'loans', 'banks', 'insurance', 'overview'])).toHaveLength(PIN_SLOTS);
  });
});

describe('togglePin / movePin', () => {
  test('pin needs a free slot; unpin always works', () => {
    expect(togglePin(['expenses', 'loans'], 'banks')).toEqual(['expenses', 'loans', 'banks']);
    expect(togglePin(DEFAULT_PINS, 'insurance')).toEqual(DEFAULT_PINS);
    expect(togglePin(DEFAULT_PINS, 'loans')).toEqual(['expenses', 'banks']);
  });
  test('move one step; ends and unknown keys change nothing', () => {
    expect(movePin(DEFAULT_PINS, 'banks', -1)).toEqual(['expenses', 'banks', 'loans']);
    expect(movePin(DEFAULT_PINS, 'expenses', -1)).toEqual(DEFAULT_PINS);
    expect(movePin(DEFAULT_PINS, 'banks', 1)).toEqual(DEFAULT_PINS);
    expect(movePin(DEFAULT_PINS, 'insurance', 1)).toEqual(DEFAULT_PINS);
  });
});

describe('bar', () => {
  test('is Home, the pins in order, then More', () => {
    expect(barItems(['insurance', 'expenses', 'banks']).map((i) => i.key)).toEqual(['home', 'insurance', 'expenses', 'banks', 'more']);
  });
  test('highlights the pinned screen that is open, Home on Home, More for anything else', () => {
    const pins = ['expenses', 'insurance', 'banks'] as const;
    expect(activeBarKey([...pins], { tab: 'home' })).toBe('home');
    expect(activeBarKey([...pins], { tab: 'expenses' })).toBe('expenses');
    expect(activeBarKey([...pins], { tab: 'more', more: 'insurance' })).toBe('insurance');
    expect(activeBarKey([...pins], { tab: 'more' })).toBe('more');
    expect(activeBarKey([...pins], { tab: 'more', more: 'profile' })).toBe('more');
    expect(activeBarKey([...pins], { tab: 'loans' })).toBe('more'); // loans is not pinned: reached through More
    expect(activeBarKey([...pins], { tab: 'more', more: 'overview' })).toBe('more');
  });
});
