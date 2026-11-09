import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as apiModule from '../../api';
import { exportFileName, parseExport, summarize } from '../../backup';
import { DataScreen } from '../DataScreen';

jest.mock('../../api');
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', writeAsStringAsync: jest.fn(async () => {}), readAsStringAsync: jest.fn() }));

const mockSession: any = { workspace: { id: 'w1', name: 'Family' }, isAdmin: true };
jest.mock('../../session', () => ({
  useSession: () => mockSession,
  errorMessage: (e: any, f = 'Something went wrong.') => e?.message || f,
}));

jest.setTimeout(20000);
const api = jest.mocked(apiModule) as any;
const Picker = require('expo-document-picker');
const Sharing = require('expo-sharing');
const FS = require('expo-file-system/legacy');

const good = { format: 'family-finance-export', version: 1, workspace: { name: 'Old home' }, expenses: [{ ref: 'a' }, { ref: 'b' }], loans: [{ ref: 'c' }], persons: [] };
const pickFile = (text: string, size = 100) => {
  Picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/x.json', name: 'x.json', size }] });
  FS.readAsStringAsync.mockResolvedValue(text);
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSession, { isAdmin: true });
  Sharing.isAvailableAsync.mockResolvedValue(true);
});

describe('file rules', () => {
  test('file name carries the date', () => {
    expect(exportFileName(new Date('2026-11-09T10:00:00Z'))).toBe('family-finance-export-2026-11-09.json');
  });
  test('parseExport accepts our format only', () => {
    expect('file' in parseExport(JSON.stringify(good))).toBe(true);
    expect(parseExport('not json')).toEqual({ error: 'This file is not valid JSON.' });
    expect((parseExport('{"a":1}') as any).error).toMatch(/not a Family Finance export/);
    expect((parseExport(JSON.stringify({ ...good, version: 7 })) as any).error).toMatch(/version 7/);
  });
  test('summarize lists non-empty sections', () => {
    expect(summarize(good as any)).toEqual([{ label: 'Expenses', count: 2 }, { label: 'Loans', count: 1 }]);
  });
});

describe('export', () => {
  test('writes the server export to a file and opens the share sheet', async () => {
    api.getExport.mockResolvedValue(good);
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Export to a file'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(api.getExport).toHaveBeenCalledWith('w1');
    expect(FS.writeAsStringAsync.mock.calls[0][0]).toMatch(/^file:\/\/\/cache\/family-finance-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(FS.writeAsStringAsync.mock.calls[0][1]).format).toBe('family-finance-export');
  });

  test('says so when sharing is not available', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Export to a file'));
    await screen.findByText('Sharing is not available on this device.');
    expect(api.getExport).not.toHaveBeenCalled();
  });

  test('shows a server error', async () => {
    api.getExport.mockRejectedValue(new Error('Server down'));
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Export to a file'));
    await screen.findByText('Server down');
  });
});

describe('import', () => {
  test('shows what is in the file, then imports only after confirmation', async () => {
    pickFile(JSON.stringify(good));
    api.importBackup.mockResolvedValue({ message: 'Import finished', counts: { expenses: 2, loans: 1 } });
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Choose a file'));
    await screen.findByText('Import this file?');
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(api.importBackup).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Import now'));
    await waitFor(() => expect(api.importBackup).toHaveBeenCalledWith('w1', good));
    await screen.findByText('Imported 3 items into Family.');
  });

  test('cancelling the picker or the confirmation changes nothing', async () => {
    Picker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Choose a file'));
    await waitFor(() => expect(Picker.getDocumentAsync).toHaveBeenCalled());
    expect(screen.queryByText('Import this file?')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose a file' })).toBeEnabled());
    pickFile(JSON.stringify(good));
    fireEvent.press(screen.getByText('Choose a file'));
    fireEvent.press(await screen.findByText('Cancel'));
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  test('refuses a file that is not an export, or is too large, before any upload', async () => {
    pickFile('{"hello":"world"}');
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Choose a file'));
    await screen.findByText(/not a Family Finance export/);
    pickFile(JSON.stringify(good), 9 * 1024 * 1024);
    fireEvent.press(screen.getByText('Choose a file'));
    await screen.findByText('This file is too large to import (limit 4 MB).');
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  test('shows the server message when the import is refused', async () => {
    pickFile(JSON.stringify(good));
    api.importBackup.mockRejectedValue(new Error('expenses[1]: amount must be a number between 0 and 9999999999.99'));
    render(<DataScreen onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Choose a file'));
    fireEvent.press(await screen.findByText('Import now'));
    await screen.findByText(/expenses\[1\]: amount must be a number/);
  });

  test('only admins see the import button', () => {
    Object.assign(mockSession, { isAdmin: false });
    render(<DataScreen onBack={jest.fn()} />);
    expect(screen.queryByText('Choose a file')).toBeNull();
    expect(screen.getByText('Only workspace admins can import.')).toBeTruthy();
    expect(screen.getByText('Export to a file')).toBeTruthy();
  });
});
