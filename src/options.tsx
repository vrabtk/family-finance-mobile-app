// User-managed choices (expense categories, loan / investment / insurance types). Nothing is fixed in the app:
// the server keeps the lists per workspace, and every dropdown reads them from here.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addOption, getOptions, removeOption, renameOption } from './api';
import { useAsync } from './hooks';
import { errorMessage, useSession } from './session';
import { colors, space, type } from './theme';
import type { OptionKind, OptionLists } from './types';
import { Button, ErrorBanner, Field, IconButton, Select, Sheet } from './ui';

export const OPTION_TITLES: Record<OptionKind, string> = {
  expenseCategory: 'Categories', loanType: 'Loan types', investmentType: 'Investment types', insuranceType: 'Insurance types',
};

export const capitalize = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '');

type Ctx = { lists: OptionLists | null; names: (kind: OptionKind) => string[]; refetch: () => Promise<void> };
const OptionsCtx = createContext<Ctx | null>(null);

// Loads the lists once for the active workspace; screens below share them.
export function OptionsProvider({ children }: { children: ReactNode }) {
  const { workspace } = useSession();
  const wid = workspace?.id ?? '';
  const { data, refetch } = useAsync(() => (wid ? getOptions(wid) : Promise.resolve(null)), [wid]);
  const value = useMemo<Ctx>(() => ({
    lists: data,
    names: (kind) => (data?.[kind] ?? []).map((o) => o.name),
    refetch: async () => { await refetch(); },
  }), [data, refetch]);
  return <OptionsCtx.Provider value={value}>{children}</OptionsCtx.Provider>;
}

export const useOptions = () => {
  const v = useContext(OptionsCtx);
  if (!v) throw new Error('useOptions must be used inside OptionsProvider');
  return v;
};

// Dropdown over one list, plus "Add or edit choices" for people who can write.
// `autoPick` (new records) selects the first choice when the current value is not in the list.
export function OptionSelect({ label, kind, value, onChange, autoPick }: {
  label: string; kind: OptionKind; value: string; onChange: (v: string) => void; autoPick?: boolean;
}) {
  const { canWrite } = useSession();
  const { names } = useOptions();
  const [managing, setManaging] = useState(false);
  const list = names(kind);
  const first = list[0];

  useEffect(() => {
    if (autoPick && first && !list.includes(value)) onChange(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPick, first, value]);

  // A value already stored on a record stays selectable even if it is not in the list any more.
  const shown = value && !list.includes(value) ? [value, ...list] : list;
  return (
    <View style={{ marginBottom: space.sm }}>
      <Select label={label} options={shown.map((n) => ({ value: n, label: capitalize(n) }))} value={value} onChange={onChange} />
      {canWrite && (
        <Pressable onPress={() => setManaging(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add or edit ${OPTION_TITLES[kind].toLowerCase()}`} style={{ alignSelf: 'flex-start', marginTop: -space.sm, marginBottom: space.sm }}>
          <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>Add or edit choices</Text>
        </Pressable>
      )}
      {managing && <ManageOptionsSheet kind={kind} onClose={() => setManaging(false)} onRenamed={(from, to) => { if (from === value) onChange(to); }} />}
    </View>
  );
}

// Add, rename and delete the choices of one list. The server refuses to delete a choice that is in use.
export function ManageOptionsSheet({ kind, onClose, onRenamed }: { kind: OptionKind; onClose: () => void; onRenamed?: (from: string, to: string) => void }) {
  const { workspace, isAdmin } = useSession();
  const { lists, refetch } = useOptions();
  const wid = workspace?.id ?? '';
  const items = lists?.[kind] ?? [];
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; from: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await action(); await refetch(); return true; } catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  }, [refetch]);

  const submit = async () => {
    const text = name.trim();
    if (!text) { setError('Type a name first.'); return; }
    const ok = editing
      ? await run(() => renameOption(wid, editing.id, text))
      : await run(() => addOption(wid, kind, text));
    if (ok) {
      if (editing) onRenamed?.(editing.from, text);
      setName('');
      setEditing(null);
    }
  };

  return (
    <Sheet visible title={OPTION_TITLES[kind]} onClose={onClose}>
      {items.map((o) => (
        <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
          <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{capitalize(o.name)}</Text>
          <IconButton icon="edit-2" label={`Rename ${o.name}`} onPress={() => { setEditing({ id: o.id, from: o.name }); setName(o.name); setError(''); }} />
          {isAdmin && <IconButton icon="trash-2" tone="negative" label={`Delete ${o.name}`} onPress={() => run(() => removeOption(wid, o.id))} />}
        </View>
      ))}
      <View style={{ marginTop: space.md }}>
        <Field label={editing ? `Rename "${editing.from}"` : 'New choice'} value={name} onChangeText={setName} placeholder="Type a name" autoCapitalize="words" />
        <ErrorBanner message={error} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {editing && <Button label="Cancel" variant="secondary" onPress={() => { setEditing(null); setName(''); setError(''); }} style={{ flex: 1 }} />}
          <Button label={editing ? 'Save name' : 'Add'} icon={editing ? 'check' : 'plus'} onPress={submit} loading={busy} style={{ flex: 2 }} />
        </View>
      </View>
    </Sheet>
  );
}
