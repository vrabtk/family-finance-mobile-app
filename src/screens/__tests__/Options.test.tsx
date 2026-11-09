import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import * as apiModule from '../../api';
import { OptionSelect, OptionsProvider } from '../../options';

jest.mock('../../api');
const mockSession: any = { workspace: { id: 'w1' }, canWrite: true, isAdmin: true };
jest.mock('../../session', () => ({
  useSession: () => mockSession,
  errorMessage: (e: any, f = 'Something went wrong.') => e?.message || f,
}));

jest.setTimeout(20000);
const api = jest.mocked(apiModule) as any;
const lists = (names: string[]) => ({
  expenseCategory: [], loanType: [], insuranceType: [],
  investmentType: names.map((name, i) => ({ id: `o${i}`, name, sortOrder: i })),
});

function Harness({ initial = '', autoPick = false }: { initial?: string; autoPick?: boolean }) {
  const [v, setV] = useState(initial);
  return <OptionSelect label="Type" kind="investmentType" value={v} onChange={setV} autoPick={autoPick} />;
}
const show = async (props = {}) => {
  render(<OptionsProvider><Harness {...props} /></OptionsProvider>);
  await waitFor(() => expect(api.getOptions).toHaveBeenCalled());
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSession, { canWrite: true, isAdmin: true });
  api.getOptions.mockResolvedValue(lists(['other']));
});

test('a new record picks the first choice by itself', async () => {
  api.getOptions.mockResolvedValue(lists(['gold', 'stock']));
  await show({ autoPick: true });
  await screen.findByText('Gold');
});

test('an existing record keeps a value that is no longer in the list', async () => {
  await show({ initial: 'legacy' });
  await screen.findByText('Legacy');
});

test('add a choice from the form', async () => {
  api.addOption.mockResolvedValue({});
  await show();
  fireEvent.press(await screen.findByLabelText('Add or edit investment types'));
  fireEvent.changeText(await screen.findByLabelText('New choice'), 'Mutual fund');
  fireEvent.press(screen.getByText('Add'));
  await waitFor(() => expect(api.addOption).toHaveBeenCalledWith('w1', 'investmentType', 'Mutual fund'));
  await waitFor(() => expect(api.getOptions).toHaveBeenCalledTimes(2));
});

test('rename updates the selection that used the old name', async () => {
  api.renameOption.mockResolvedValue({});
  api.getOptions.mockResolvedValue(lists(['gold', 'stock']));
  await show({ initial: 'gold' });
  fireEvent.press(await screen.findByLabelText('Add or edit investment types'));
  fireEvent.press(await screen.findByLabelText('Rename gold'));
  fireEvent.changeText(screen.getByLabelText('Rename "gold"'), 'Gold coins');
  fireEvent.press(screen.getByText('Save name'));
  await waitFor(() => expect(api.renameOption).toHaveBeenCalledWith('w1', 'o0', 'Gold coins'));
});

test('admins can delete; the server message is shown when a choice is in use', async () => {
  api.getOptions.mockResolvedValue(lists(['gold', 'stock']));
  api.removeOption.mockRejectedValue(new Error('2 items still use "gold". Change them first.'));
  await show();
  fireEvent.press(await screen.findByLabelText('Add or edit investment types'));
  fireEvent.press(await screen.findByLabelText('Delete gold'));
  await screen.findByText('2 items still use "gold". Change them first.');
});

test('members cannot delete, viewers cannot edit the list at all', async () => {
  Object.assign(mockSession, { isAdmin: false });
  await show();
  fireEvent.press(await screen.findByLabelText('Add or edit investment types'));
  await screen.findByLabelText('Rename other');
  expect(screen.queryByLabelText('Delete other')).toBeNull();
});

test('viewers see no manage link', async () => {
  Object.assign(mockSession, { canWrite: false, isAdmin: false });
  await show();
  expect(screen.queryByLabelText('Add or edit investment types')).toBeNull();
});
