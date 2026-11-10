import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Crud } from '../api';
import { dateInput } from '../format';
import { useAsync } from '../hooks';
import { OptionSelect, capitalize, useOptions } from '../options';
import { errorMessage, useSession } from '../session';
import { space, type } from '../theme';
import type { TourId } from '../tour/steps';
import type { OptionKind } from '../types';
import {
  Badge, Button, Card, Chips, ConfirmSheet, Empty, ErrorBanner, Fab, Field, IconName, Loading, Screen, SectionTitle, Sheet, Stat, Tone,
} from '../ui';

export type FieldDef = {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'option' | 'multiline';
  optionKind?: OptionKind; // for kind 'option': the user-managed list this field draws from
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
};

export type RowView = {
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: { label: string; tone: Tone };
  group?: string; // optional section header; rows are listed under it
};

export type SummaryTile = { label: string; value: string; tone: Tone; icon: IconName };

export type ResourceConfig = {
  title: string;
  tour: TourId; // this screen's guide
  noun: string; // "loan" -> "Add loan", "Delete loan"
  icon: IconName;
  emptyHint: string;
  crud: Crud;
  fields: FieldDef[];
  summary: (items: any[]) => SummaryTile[];
  row: (item: any) => RowView;
  filter?: { optionKind: OptionKind; match: (item: any, value: string) => boolean };
  groupOrder?: string[];
};

type Form = Record<string, string>;

const initialForm = (fields: FieldDef[], item?: any): Form =>
  Object.fromEntries(fields.map((f) => {
    const raw = item?.[f.key];
    if (f.kind === 'date') return [f.key, dateInput(raw)];
    if (raw === null || raw === undefined) return [f.key, f.defaultValue ?? (f.kind === 'select' ? f.options?.[0]?.value ?? '' : '')];
    return [f.key, String(raw)];
  }));

// Empty optional fields go to the API as null so they clear on edit.
const toPayload = (fields: FieldDef[], form: Form): Record<string, unknown> =>
  Object.fromEntries(fields.map((f) => {
    const v = (form[f.key] ?? '').trim();
    if (f.kind === 'number') return [f.key, v === '' ? (f.required ? 0 : null) : Number(v)];
    if (f.kind === 'date') return [f.key, v === '' ? null : v];
    return [f.key, v === '' && !f.required ? null : v];
  }));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ResourceScreen({ config, onBack }: { config: ResourceConfig; onBack?: () => void }) {
  const { workspace, canWrite, isAdmin } = useSession();
  const wid = workspace?.id ?? '';
  const { data, loading, refreshing, error, reload } = useAsync(() => config.crud.list(wid), [wid]);

  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState<Form>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { names } = useOptions();
  const items = data ?? [];
  const visible = config.filter && filter !== 'all' ? items.filter((i) => config.filter!.match(i, filter)) : items;

  const open = (item: any | 'new') => {
    setForm(initialForm(config.fields, item === 'new' ? undefined : item));
    setFormError('');
    setEditing(item);
  };
  const close = () => { setEditing(null); setConfirmDelete(false); };

  const save = async () => {
    const missing = config.fields.find((f) => f.required && !(form[f.key] ?? '').trim());
    if (missing) { setFormError(`${missing.label} is required.`); return; }
    const badDate = config.fields.find((f) => f.kind === 'date' && form[f.key]?.trim() && !DATE_RE.test(form[f.key].trim()));
    if (badDate) { setFormError(`${badDate.label} must be a date like 2026-03-31.`); return; }
    const badNumber = config.fields.find((f) => f.kind === 'number' && form[f.key]?.trim() && !Number.isFinite(Number(form[f.key])));
    if (badNumber) { setFormError(`${badNumber.label} must be a number.`); return; }

    setSaving(true);
    setFormError('');
    try {
      const payload = toPayload(config.fields, form);
      if (editing === 'new') await config.crud.create(wid, payload);
      else await config.crud.update(wid, editing.id, payload);
      close();
      await reload();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await config.crud.remove(wid, editing.id);
      close();
      await reload();
    } catch (e) {
      setConfirmDelete(false);
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const rows = visible.map((item) => ({ item, view: config.row(item) }));
  const grouped = rows.some((r) => r.view.group);
  const groupNames = grouped
    ? [...new Set(rows.map((r) => r.view.group ?? 'Other'))].sort((a, b) => (config.groupOrder?.indexOf(a) ?? 0) - (config.groupOrder?.indexOf(b) ?? 0))
    : [''];

  const renderRow = ({ item, view }: { item: any; view: RowView }) => (
    <Card key={item.id} onPress={canWrite ? () => open(item) : undefined} style={{ padding: space.md }}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.body} numberOfLines={1}>{view.title}</Text>
          {!!view.subtitle && <Text style={type.small} numberOfLines={1}>{view.subtitle}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {!!view.amount && <Text style={[type.amount, { fontSize: 16 }]}>{view.amount}</Text>}
          {view.badge && <Badge label={view.badge.label} tone={view.badge.tone} />}
        </View>
      </View>
    </Card>
  );

  return (
    <Screen
      tour={config.tour}
      title={config.title}
      onBack={onBack}
      refreshing={refreshing}
      onRefresh={reload}
      fab={canWrite && !loading ? <Fab onPress={() => open('new')} label={`Add ${config.noun}`} /> : undefined}
    >
      <ErrorBanner message={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <>
          {items.length > 0 && (
            <View style={styles.tiles}>
              {config.summary(items).map((t) => <Stat key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />)}
            </View>
          )}
          {config.filter && items.length > 0 && <Chips options={[{ value: 'all', label: 'All' }, ...names(config.filter.optionKind).map((n) => ({ value: n, label: capitalize(n) }))]} value={filter} onChange={setFilter} />}

          {rows.length === 0 ? (
            <Empty icon={config.icon} title={items.length ? 'Nothing matches this filter' : `No ${config.title.toLowerCase()} yet`} hint={items.length ? undefined : config.emptyHint} />
          ) : groupNames.map((g) => (
            <View key={g || 'all'} style={{ gap: space.sm }}>
              {!!g && <SectionTitle>{g}</SectionTitle>}
              {rows.filter((r) => (r.view.group ?? 'Other') === g || !grouped).map(renderRow)}
            </View>
          ))}
        </>
      )}

      <Sheet visible={editing !== null} title={editing === 'new' ? `Add ${config.noun}` : `Edit ${config.noun}`} onClose={close}>
        {config.fields.map((f) => f.kind === 'option' ? (
          <OptionSelect key={f.key} label={f.label} kind={f.optionKind!} value={form[f.key] ?? ''} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} autoPick={editing === 'new'} />
        ) : f.kind === 'select' ? (
          <Chips key={f.key} label={f.label} options={f.options ?? []} value={form[f.key] ?? ''} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
        ) : (
          <Field
            key={f.key}
            label={f.required ? f.label : `${f.label} (optional)`}
            value={form[f.key] ?? ''}
            onChangeText={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
            placeholder={f.kind === 'date' ? 'YYYY-MM-DD' : f.placeholder}
            keyboardType={f.kind === 'number' ? 'decimal-pad' : f.kind === 'date' ? 'numbers-and-punctuation' : undefined}
            multiline={f.kind === 'multiline'}
          />
        ))}
        <ErrorBanner message={formError} />
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
          {editing !== 'new' && isAdmin && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} disabled={saving} style={{ flex: 1 }} />}
          <Button label="Save" onPress={save} loading={saving} style={{ flex: 2 }} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        title={`Delete ${config.noun}?`}
        message="This permanently removes it for everyone in this workspace and cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
