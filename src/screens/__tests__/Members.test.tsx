import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { MembersCard } from '../Members';

jest.mock('../../api');
jest.mock('../../session', () => ({ errorMessage: (e: any, f = 'Something went wrong.') => e?.message || f }));

const api = jest.mocked(apiModule) as any;
const rows = () => [
  { userId: 'u1', name: 'Hari', email: 'h@x.com', role: 'admin', blocked: false, joinedAt: '2026-01-01', isOwner: true },
  { userId: 'u2', name: 'Asha', email: 'a@x.com', role: 'member', blocked: false, joinedAt: '2026-01-02', isOwner: false },
  { userId: 'u3', name: 'Ravi', email: 'r@x.com', role: 'viewer', blocked: true, joinedAt: '2026-01-03', isOwner: false },
];
const show = async (isAdmin = true) => {
  api.listMembers.mockResolvedValue(rows());
  render(<MembersCard workspaceId="w1" myId="u1" isAdmin={isAdmin} />);
  await screen.findByText('Asha');
};

beforeEach(() => jest.clearAllMocks());

test('lists members with owner, role and blocked badges', async () => {
  await show();
  expect(screen.getByText('Hari (you)')).toBeTruthy();
  expect(screen.getByText('owner')).toBeTruthy();
  expect(screen.getByText('blocked')).toBeTruthy();
  expect(screen.getByText('r@x.com')).toBeTruthy();
});

test('non-admins cannot open a member', async () => {
  await show(false);
  fireEvent.press(screen.getByText('Asha'));
  expect(screen.queryByText('Block access')).toBeNull();
});

test('the owner and yourself cannot be opened', async () => {
  await show();
  fireEvent.press(screen.getByText('Hari (you)'));
  expect(screen.queryByText('Block access')).toBeNull();
});

test('admin changes a role', async () => {
  api.updateMember.mockResolvedValue({});
  await show();
  fireEvent.press(screen.getByText('Asha'));
  fireEvent.press(screen.getByText('Viewer'));
  await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('w1', 'u2', { role: 'viewer' }));
  await waitFor(() => expect(api.listMembers).toHaveBeenCalledTimes(2));
});

test('admin blocks and unblocks', async () => {
  api.updateMember.mockResolvedValue({});
  await show();
  fireEvent.press(screen.getByText('Asha'));
  fireEvent.press(screen.getByText('Block access'));
  await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('w1', 'u2', { blocked: true }));
  fireEvent.press(screen.getByText('Ravi'));
  fireEvent.press(await screen.findByText('Unblock access'));
  await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('w1', 'u3', { blocked: false }));
});

test('removing asks for confirmation first', async () => {
  api.removeMember.mockResolvedValue({});
  await show();
  fireEvent.press(screen.getByText('Asha'));
  fireEvent.press(screen.getByText('Remove from workspace'));
  expect(api.removeMember).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Remove'));
  await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('w1', 'u2'));
});

test('shows the server message when a change is refused', async () => {
  api.updateMember.mockRejectedValue(new Error('The workspace owner cannot be changed'));
  await show();
  fireEvent.press(screen.getByText('Asha'));
  fireEvent.press(screen.getByText('Block access'));
  await screen.findByText('The workspace owner cannot be changed');
});
