import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { banksApi } from '../api';
import { inr, inrCompact, toNumber } from '../format';
import { useAsync } from '../hooks';
import { errorMessage, useSession } from '../session';
import { colors, space, type } from '../theme';
import type { Bank, BankEntry, BankSection } from '../types';
import { Button, Card, ConfirmSheet, Empty, ErrorBanner, Fab, Field, Loading, Screen, Sheet, Stat } from '../ui';

type Panel =
  | { kind: 'bank'; bank?: Bank }
  | { kind: 'section'; bank: Bank }
  | { kind: 'entry'; bank: Bank; section: BankSection; entry?: BankEntry }
  | null;

type Removal = { title: string; message: string; run: () => Promise<unknown> } | null;

const sectionTotal = (s: BankSection) => s.entries.reduce((sum, e) => sum + toNumber(e.amount), 0);
const bankTotal = (b: Bank) => b.sections.reduce((sum, s) => sum + sectionTotal(s), 0);

export function BanksScreen() {
  const { workspace, canWrite, isAdmin } = useSession();
  const wid = workspace?.id ?? '';
  const { data, loading, refreshing, error, reload } = useAsync(() => banksApi.list(wid), [wid]);
  const banks = data ?? [];

  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState({ name: '', label: '', amount: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removal, setRemoval] = useState<Removal>(null);

  const close = () => { setPanel(null); setRemoval(null); setFormError(''); };
  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setFormError('');
    try { await action(); close(); await reload(); } catch (e) { setFormError(errorMessage(e)); setRemoval(null); } finally { setSaving(false); }
  };

  const open = (next: NonNullable<Panel>) => {
    const entry = next.kind === 'entry' ? next.entry : undefined;
    setForm({
      name: next.kind === 'bank' ? next.bank?.name ?? '' : '',
      label: entry?.label ?? '',
      amount: entry ? String(toNumber(entry.amount)) : '',
      notes: entry?.notes ?? '',
    });
    setFormError('');
    setPanel(next);
  };

  const save = () => run(async () => {
    if (!panel) return;
    if (panel.kind === 'bank') {
      if (!form.name.trim()) throw new Error('Bank name is required.');
      if (panel.bank) await banksApi.renameBank(wid, panel.bank.id, form.name.trim());
      else await banksApi.createBank(wid, form.name.trim());
    } else if (panel.kind === 'section') {
      if (!form.name.trim()) throw new Error('Section name is required.');
      await banksApi.createSection(wid, panel.bank.id, form.name.trim());
    } else {
      if (!form.label.trim()) throw new Error('Label is required.');
      const amount = Number(form.amount || 0);
      if (!Number.isFinite(amount)) throw new Error('Enter a valid amount.');
      const body = { label: form.label.trim(), amount, notes: form.notes.trim() || null };
      if (panel.entry) await banksApi.updateEntry(wid, panel.bank.id, panel.section.id, panel.entry.id, body);
      else await banksApi.createEntry(wid, panel.bank.id, panel.section.id, body);
    }
  });

  const total = banks.reduce((s, b) => s + bankTotal(b), 0);
  const title = !panel ? '' : panel.kind === 'bank' ? (panel.bank ? 'Rename bank' : 'Add bank') : panel.kind === 'section' ? `Add section · ${panel.bank.name}` : `${panel.entry ? 'Edit' : 'Add'} entry · ${panel.section.name}`;

  return (
    <Screen
      title="Banks"
      subtitle={banks.length ? `${banks.length} ${banks.length === 1 ? 'bank' : 'banks'}` : undefined}
      refreshing={refreshing}
      onRefresh={reload}
      fab={canWrite && !loading ? <Fab onPress={() => open({ kind: 'bank' })} label="Add bank" /> : undefined}
    >
      <ErrorBanner message={error} onRetry={reload} />
      {loading ? <Loading /> : banks.length === 0 ? (
        <Empty icon="briefcase" title="No banks yet" hint="Add a bank, then sections like Savings or Fixed deposits, and balances inside them." />
      ) : (
        <>
          <Stat label="Total across banks" value={inr(total)} icon="briefcase" tone="primary" />
          {banks.map((bank) => (
            <View key={bank.id} style={{ gap: space.sm }}>
              <View style={styles.bankHead}>
                <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>{bank.name}</Text>
                <Text style={type.amount}>{inrCompact(bankTotal(bank))}</Text>
              </View>
              <Card style={{ padding: 0 }}>
                {bank.sections.length === 0 && <Text style={[type.small, { padding: space.lg }]}>No sections yet.</Text>}
                {bank.sections.map((section, si) => (
                  <View key={section.id} style={si > 0 && styles.divider}>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionName}>{section.name}</Text>
                      <Text style={type.amount}>{inr(sectionTotal(section))}</Text>
                    </View>
                    {section.entries.map((entry) => (
                      <Pressable key={entry.id} disabled={!canWrite} onPress={() => open({ kind: 'entry', bank, section, entry })} style={styles.entry}>
                        <View style={{ flex: 1 }}>
                          <Text style={type.body} numberOfLines={1}>{entry.label}</Text>
                          {!!entry.notes && <Text style={type.small} numberOfLines={1}>{entry.notes}</Text>}
                        </View>
                        <Text style={type.amount}>{inr(entry.amount)}</Text>
                      </Pressable>
                    ))}
                    {canWrite && (
                      <Pressable onPress={() => open({ kind: 'entry', bank, section })} style={styles.add} accessibilityRole="button">
                        <Feather name="plus" size={14} color={colors.primary} /><Text style={styles.addLabel}>Add entry</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </Card>
              {canWrite && (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="Add section" small icon="plus" variant="secondary" onPress={() => open({ kind: 'section', bank })} />
                  <Button label="Rename" small variant="ghost" onPress={() => open({ kind: 'bank', bank })} />
                  {isAdmin && (
                    <Button
                      label="Delete bank" small variant="danger"
                      onPress={() => setRemoval({ title: `Delete ${bank.name}?`, message: 'The bank with all its sections and entries is removed permanently.', run: () => banksApi.removeBank(wid, bank.id) })}
                    />
                  )}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      <Sheet visible={!!panel} title={title} onClose={close}>
        {panel?.kind === 'entry' ? (
          <>
            <Field label="Label" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="e.g. Salary account" />
            <Field label="Balance (₹)" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" placeholder="0" />
            <Field label="Notes (optional)" value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} />
          </>
        ) : (
          <Field label={panel?.kind === 'section' ? 'Section name' : 'Bank name'} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder={panel?.kind === 'section' ? 'e.g. Savings' : 'e.g. HDFC'} />
        )}
        <ErrorBanner message={formError} />
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
          {panel?.kind === 'entry' && panel.entry && isAdmin && (
            <Button
              label="Delete" variant="danger" disabled={saving} style={{ flex: 1 }}
              onPress={() => setRemoval({ title: 'Delete entry?', message: 'This balance entry is removed permanently.', run: () => banksApi.removeEntry(wid, panel.bank.id, panel.section.id, panel.entry!.id) })}
            />
          )}
          <Button label="Save" onPress={save} loading={saving} style={{ flex: 2 }} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={!!removal}
        title={removal?.title ?? ''}
        message={removal?.message ?? ''}
        confirmLabel="Delete"
        onConfirm={() => removal && run(async () => { await removal.run(); })}
        onClose={() => setRemoval(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bankHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceAlt, paddingHorizontal: space.lg, paddingVertical: space.sm },
  sectionName: { ...type.caption, color: colors.textDim },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingVertical: space.md },
  addLabel: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
