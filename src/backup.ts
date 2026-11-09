// Export / import of a whole workspace as one JSON file (the server defines the format; see backend backup.service).
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getExport, importBackup } from './api';

export const EXPORT_FORMAT = 'family-finance-export';
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // the server accepts 5 MB of JSON; leave room for the request wrapper

export type ExportFile = { format: string; version: number; workspace?: { name?: string }; exportedAt?: string; [section: string]: unknown };

const SECTION_LABELS: Array<[string, string]> = [
  ['persons', 'People'], ['years', 'Years'], ['groups', 'Months'], ['salaryEntries', 'Salaries'], ['expenses', 'Expenses'],
  ['loans', 'Loans'], ['investments', 'Investments'], ['insurance', 'Insurance policies'], ['banks', 'Banks'],
  ['bankEntries', 'Bank entries'], ['overview', 'Overview items'],
];

export const exportFileName = (now: Date = new Date()) => `family-finance-export-${now.toISOString().slice(0, 10)}.json`;

// Reads the text of a chosen file; returns the parsed export or an error message to show.
export function parseExport(text: string): { file: ExportFile } | { error: string } {
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { return { error: 'This file is not valid JSON.' }; }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== EXPORT_FORMAT) {
    return { error: 'This is not a Family Finance export file. Export one from the app first.' };
  }
  if (parsed.version !== 1) return { error: `This export is version ${parsed.version}, which this app cannot read.` };
  return { file: parsed as ExportFile };
}

// What the file contains, for the confirmation step (empty sections are left out).
export function summarize(file: ExportFile): Array<{ label: string; count: number }> {
  return SECTION_LABELS
    .map(([key, label]) => ({ label, count: Array.isArray(file[key]) ? (file[key] as unknown[]).length : 0 }))
    .filter((row) => row.count > 0);
}

export async function shareExport(workspaceId: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const data = await getExport(workspaceId);
  const uri = `${FileSystem.cacheDirectory}${exportFileName()}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save or send your Family Finance export', UTI: 'public.json' });
}

// Lets the user pick a file. Returns null when they cancel.
export async function pickExport(): Promise<{ file: ExportFile; name: string } | { error: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_IMPORT_BYTES) return { error: 'This file is too large to import (limit 4 MB).' };
  const parsed = parseExport(await FileSystem.readAsStringAsync(asset.uri));
  return 'error' in parsed ? parsed : { file: parsed.file, name: asset.name };
}

export const runImport = (workspaceId: string, file: ExportFile) => importBackup(workspaceId, file);
