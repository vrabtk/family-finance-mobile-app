import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { MoreScreen } from '../MoreScreen';

jest.mock('../../api');
jest.mock('../../config', () => ({ API_BASE_URL: 'https://api.test/api/v1', HAS_API_CONFIG: true }));

const mockSignOut = jest.fn(async () => {});
jest.mock('../../session', () => ({
  useSession: () => ({ session: { user: { name: 'Hari Krishna', email: 'h@x.com' } }, workspace: { id: 'w1', name: 'Family', role: 'admin' }, signOut: mockSignOut }),
  errorMessage: (e: any, fallback = 'Something went wrong.') => e?.message || fallback,
}));

const api = jest.mocked(apiModule) as any;
const open = () => { render(<MoreScreen open={jest.fn()} />); fireEvent.press(screen.getByText('Delete account')); };
const sheet = () => screen.getByTestId('sheet');
const typePassword = (v: string) => fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), v);

test('never shows the server address', () => {
  render(<MoreScreen open={jest.fn()} />);
  expect(screen.queryByText(/Server:/)).toBeNull();
  expect(screen.queryByText(/api\.test/)).toBeNull();
});

describe('delete account', () => {
  test('is offered on the More screen and opens a confirmation that explains what is deleted', () => {
    open();
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(screen.getByText('This permanently deletes your account and cannot be undone.')).toBeTruthy();
    expect(screen.getByText(/ownership passes to another admin/)).toBeTruthy();
    expect(sheet()).toBeTruthy();
  });

  test('the delete button stays disabled until a password is typed', () => {
    open();
    fireEvent.press(screen.getByText('Delete my account'));
    expect(api.deleteAccount).not.toHaveBeenCalled();
    typePassword('secret-pw');
    fireEvent.press(screen.getByText('Delete my account'));
    expect(api.deleteAccount).toHaveBeenCalledWith('secret-pw');
  });

  test('on success the user is signed out on this device', async () => {
    api.deleteAccount.mockResolvedValueOnce({ message: 'Account deleted', deletedWorkspaces: 1, transferredWorkspaces: 0 });
    open();
    typePassword('secret-pw');
    fireEvent.press(screen.getByText('Delete my account'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  test('a wrong password shows the server message, keeps the sheet open and does not sign out', async () => {
    api.deleteAccount.mockRejectedValueOnce(new Error('Incorrect password'));
    open();
    typePassword('wrong');
    fireEvent.press(screen.getByText('Delete my account'));
    expect(await screen.findByText('Incorrect password')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText('Delete your account?')).toBeTruthy();
  });

  test('the shared-workspace refusal is shown in full so the user knows what to do', async () => {
    const message = 'Make another member an admin or remove the other members of: Family';
    api.deleteAccount.mockRejectedValueOnce(new Error(message));
    open();
    typePassword('secret-pw');
    fireEvent.press(screen.getByText('Delete my account'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  test('cancel closes the sheet without calling the server', async () => {
    open();
    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryAllByText('Delete your account?').length).toBe(0));
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });
});
