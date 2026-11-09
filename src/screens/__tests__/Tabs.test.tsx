import { fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_PINS } from '../../navigation';
import { MoreScreen } from '../MoreScreen';
import { TabsScreen } from '../TabsScreen';

jest.mock('../../api');
jest.mock('../../session', () => ({
  useSession: () => ({ session: { user: { name: 'A', email: 'a@x.com' } }, workspace: { id: 'w1', name: 'F', role: 'admin' }, signOut: jest.fn() }),
  errorMessage: (e: any, f = '') => e?.message || f,
}));

test('More lists exactly the screens that are not pinned, plus profile and customize', () => {
  render(<MoreScreen pins={['insurance', 'banks', 'loans']} open={jest.fn()} />);
  for (const t of ['Expenses', 'Investments', 'Monthly overview', 'Workspace & members', 'My profile', 'Customize bottom bar']) expect(screen.getByText(t)).toBeTruthy();
  for (const t of ['Insurance', 'Banks', 'Loans']) expect(screen.queryByText(t)).toBeNull();
});

test('opening an item from More reports which one', () => {
  const open = jest.fn();
  render(<MoreScreen pins={DEFAULT_PINS} open={open} />);
  fireEvent.press(screen.getByText('Investments'));
  expect(open).toHaveBeenCalledWith('investments');
  fireEvent.press(screen.getByText('Customize bottom bar'));
  expect(open).toHaveBeenCalledWith('tabs');
});

describe('customize screen', () => {
  const show = (pins = DEFAULT_PINS) => { const onChange = jest.fn(); render(<TabsScreen pins={pins} onChange={onChange} onBack={jest.fn()} />); return onChange; };

  test('unpin, reorder and pin', () => {
    const onChange = show();
    fireEvent.press(screen.getByLabelText('Unpin Loans'));
    expect(onChange).toHaveBeenLastCalledWith(['expenses', 'banks']);
    fireEvent.press(screen.getByLabelText('Move Banks up'));
    expect(onChange).toHaveBeenLastCalledWith(['expenses', 'banks', 'loans']);
  });

  test('pins a new screen when there is a free slot', () => {
    const onChange = show(['expenses', 'banks']);
    fireEvent.press(screen.getByLabelText('Pin Insurance'));
    expect(onChange).toHaveBeenLastCalledWith(['expenses', 'banks', 'insurance']);
  });

  test('when the bar is full, pinning is blocked with an explanation', () => {
    const onChange = show();
    expect(screen.getByText('The bar is full. Unpin one to pin another.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Pin Insurance'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
