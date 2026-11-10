import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TourProvider } from '../../tour/TourProvider';
import { Screen } from '../../ui';
import { TourScreen } from '../TourScreen';

const mockRole: { value: string } = { value: 'admin' };
jest.mock('../../session', () => ({
  useSession: () => ({ role: mockRole.value }),
  errorMessage: (e: any, f = '') => e?.message || f,
}));
const mockPrefs: Record<string, unknown> = {};
jest.mock('../../storage', () => ({
  loadPrefs: jest.fn(async () => ({ ...mockPrefs })),
  savePrefs: jest.fn(async (p: Record<string, unknown>) => { Object.keys(mockPrefs).forEach((k) => delete mockPrefs[k]); Object.assign(mockPrefs, p); }),
}));

jest.setTimeout(20000);
const navigate = jest.fn();

const show = (ui: React.ReactElement, access: 'viewer' | 'member' | 'admin' = 'admin', autoStart = false) => {
  mockRole.value = access;
  return render(<TourProvider navigate={navigate} access={access} autoStart={autoStart}>{ui}</TourProvider>);
};
const menu = () => show(<TourScreen onBack={jest.fn()} />);

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockPrefs).forEach((k) => delete mockPrefs[k]);
});

describe('the guide menu', () => {
  test('offers the complete tour and one guide per screen', async () => {
    menu();
    await screen.findByText('Start the complete tour');
    for (const name of ['Dashboard', 'Expenses', 'Loans', 'Banks', 'Investments', 'Insurance', 'Monthly overview', 'Analytics', 'Workspace and members', 'My profile', 'Export and import', 'Bottom bar']) {
      expect(screen.getByLabelText(`Guide: ${name}`)).toBeTruthy();
    }
  });

  test('the complete tour opens its first screen and walks forward and back', async () => {
    menu();
    fireEvent.press(await screen.findByText('Start the complete tour'));
    await screen.findByText('Welcome to Family Finance');
    expect(navigate).toHaveBeenLastCalledWith({ tab: 'home' });
    expect(screen.getByText('Step 1 of 20')).toBeTruthy();
    fireEvent.press(screen.getByText('Next'));
    await screen.findByText('Your net worth');
    fireEvent.press(screen.getByText('Back'));
    await screen.findByText('Welcome to Family Finance');
  });

  test('a one-screen guide shows only its own steps and opens that screen', async () => {
    menu();
    fireEvent.press(await screen.findByLabelText('Guide: Expenses'));
    await screen.findByText('Years and months');
    expect(navigate).toHaveBeenLastCalledWith({ tab: 'expenses' });
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    fireEvent.press(screen.getByText('Next'));
    await screen.findByText('The month at a glance');
    fireEvent.press(screen.getByText('Next'));
    fireEvent.press(screen.getByText('Next'));
    await screen.findByText('Add with the plus button');
    expect(navigate).toHaveBeenLastCalledWith({ tab: 'expenses' });
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('Add with the plus button')).toBeNull());
  });

  test('finishing a guide is remembered and shows as Seen', async () => {
    menu();
    fireEvent.press(await screen.findByLabelText('Guide: Bottom bar'));
    await screen.findByText('Pin your favourites');
    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(mockPrefs.toursSeen).toEqual(['tabs']));
    await screen.findByText('Seen');
    expect(navigate).toHaveBeenCalledWith({ tab: 'more', more: 'tabs' });
  });

  test('skipping or closing also counts as seen, so it is never forced again', async () => {
    menu();
    fireEvent.press(await screen.findByLabelText('Guide: Loans'));
    await screen.findByText('Loans and EMIs');
    fireEvent.press(screen.getByLabelText('Close the guide'));
    await waitFor(() => expect(mockPrefs.toursSeen).toEqual(['loans']));
    await waitFor(() => expect(screen.queryByText('Loans and EMIs')).toBeNull());
  });
});

describe('who sees what', () => {
  test('viewers get no steps about adding things', async () => {
    show(<TourScreen onBack={jest.fn()} />, 'viewer');
    fireEvent.press(await screen.findByLabelText('Guide: Expenses'));
    await screen.findByText('Step 1 of 3');
    for (let i = 0; i < 2; i++) fireEvent.press(screen.getByText('Next'));
    await screen.findByText('Bills, People, Other income');
    expect(screen.getByText('Done')).toBeTruthy();   // last step is the third one: the add step is hidden
  });

  test('admin-only invitations are not explained to members', async () => {
    show(<TourScreen onBack={jest.fn()} />, 'member');
    fireEvent.press(await screen.findByLabelText('Guide: Workspace and members'));
    await screen.findByText('Step 1 of 1');
  });
});

describe('help button and first run', () => {
  test('a screen with a guide has a help button that starts it', async () => {
    show(<Screen tour="loans" title="Loans"><Text>content</Text></Screen>);
    fireEvent.press(await screen.findByLabelText('Show the guide for this screen'));
    await screen.findByText('Loans and EMIs');
  });

  test('without the tour system (as in screen tests) there is no help button', () => {
    render(<Screen tour="loans" title="Loans"><Text>content</Text></Screen>);
    expect(screen.queryByLabelText('Show the guide for this screen')).toBeNull();
  });

  test('the complete tour starts by itself on first use, once', async () => {
    show(<Text>app</Text>, 'admin', true);
    await screen.findByText('Welcome to Family Finance', {}, { timeout: 4000 });
    fireEvent.press(screen.getByLabelText('Close the guide'));
    await waitFor(() => expect(mockPrefs.toursSeen).toEqual(['full']));
  });

  test('it does not start again once it was seen', async () => {
    mockPrefs.toursSeen = ['full'];
    show(<Text>app</Text>, 'admin', true);
    await new Promise((r) => setTimeout(r, 1800));
    expect(screen.queryByText('Welcome to Family Finance')).toBeNull();
  });

  test('garbage saved on the device is ignored', async () => {
    mockPrefs.toursSeen = 'nonsense';
    menu();
    await screen.findByText('Start the complete tour');
    expect(screen.queryByText('Seen')).toBeNull();
  });
});
