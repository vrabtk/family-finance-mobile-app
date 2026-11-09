import { useState } from 'react';
import { Text, View } from 'react-native';
import { ExportFile, pickExport, runImport, shareExport, summarize } from '../backup';
import { errorMessage, useSession } from '../session';
import { colors, space, type } from '../theme';
import { Button, Card, ConfirmSheet, ErrorBanner, Screen, SectionTitle } from '../ui';

// Back up everything in the workspace to a file, or add the contents of such a file to it.
export function DataScreen({ onBack }: { onBack: () => void }) {
  const { workspace, isAdmin } = useSession();
  const wid = workspace?.id ?? '';
  const [busy, setBusy] = useState<'export' | 'pick' | 'import' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [picked, setPicked] = useState<{ file: ExportFile; name: string } | null>(null);

  const exportAll = async () => {
    setBusy('export'); setError(''); setDone('');
    try { await shareExport(wid); } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  const choose = async () => {
    setBusy('pick'); setError(''); setDone('');
    try {
      const res = await pickExport();
      if (res && 'error' in res) setError(res.error);
      else if (res) setPicked(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async () => {
    if (!picked) return;
    setBusy('import'); setError('');
    try {
      const res = await runImport(wid, picked.file);
      const total = Object.values(res.counts ?? {}).reduce((s: number, n) => s + Number(n), 0);
      setDone(`Imported ${total} ${total === 1 ? 'item' : 'items'} into ${workspace?.name ?? 'this workspace'}.`);
      setPicked(null);
    } catch (e) {
      setError(errorMessage(e));
      setPicked(null);
    } finally {
      setBusy(null);
    }
  };

  const rows = picked ? summarize(picked.file) : [];
  return (
    <Screen title="Export and import" subtitle={workspace?.name} onBack={onBack}>
      <ErrorBanner message={error} />
      {!!done && <Card><Text style={[type.body, { color: colors.positive }]}>{done}</Text></Card>}

      <SectionTitle>Export</SectionTitle>
      <Card>
        <Text style={[type.small, { marginBottom: space.md }]}>
          Saves everything in this workspace (expenses, salaries, loans, investments, insurance, banks, overview) as one file you can keep or send to yourself. No passwords or account details are included.
        </Text>
        <Button label="Export to a file" icon="share" onPress={exportAll} loading={busy === 'export'} disabled={!!busy} />
      </Card>

      <SectionTitle>Import</SectionTitle>
      <Card>
        {isAdmin ? (
          <>
            <Text style={[type.small, { marginBottom: space.md }]}>
              Adds the contents of an export file to this workspace. Nothing is replaced or deleted, so importing the same file twice adds everything twice.
            </Text>
            <Button label="Choose a file" icon="upload" variant="secondary" onPress={choose} loading={busy === 'pick'} disabled={!!busy} />
          </>
        ) : (
          <Text style={type.small}>Only workspace admins can import.</Text>
        )}
      </Card>

      <ConfirmSheet
        visible={!!picked}
        title="Import this file?"
        message=""
        confirmLabel={busy === 'import' ? 'Importing…' : 'Import now'}
        onConfirm={confirmImport}
        onClose={() => busy !== 'import' && setPicked(null)}
        details={
          picked ? (
            <View style={{ marginBottom: space.md }}>
              <Text style={type.body}>{picked.name}</Text>
              <Text style={[type.small, { marginBottom: space.sm }]}>From "{picked.file.workspace?.name ?? 'a workspace'}". It will be added to "{workspace?.name}".</Text>
              {rows.length === 0 ? <Text style={type.small}>The file has no data.</Text> : rows.map((r) => (
                <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={type.small}>{r.label}</Text>
                  <Text style={type.body}>{r.count}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
