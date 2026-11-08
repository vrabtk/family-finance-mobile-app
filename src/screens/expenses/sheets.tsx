// Bottom sheets for the Expenses module. Each is mounted only while open, so its form always starts fresh.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { inr } from '../../format';
import type { ExpensesApi } from '../../expenses/useExpenses';
import {
  CATEGORIES, ExpenseForm, PERSON_COLORS, cleanLabel, emptyExpenseForm, formFromExpense, isArchivedPeriod, parseAmount, parseExpenseForm,
} from '../../expenses/logic';
import { colors, space, type } from '../../theme';
import type { Expense, Person } from '../../types';
import { Button, Chips, ConfirmSheet, ErrorBanner, Field, Select, Sheet } from '../../ui';

// Runs an action that returns an error message (or null) and closes the sheet on success.
function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (action: () => Promise<string | null> | string | null) => {
    setBusy(true);
    setError('');
    const result = await action();
    setBusy(false);
    if (result) setError(result);
    else onDone();
  };
  return { busy, error, submit };
}

const periodWord = (x: ExpensesApi) => (x.year?.hasSubgroups ? 'month' : 'year');

// ── Expense ──────────────────────────────────────────────────────────────────
export function ExpenseSheet({ x, item, onClose }: { x: ExpensesApi; item?: Expense; onClose: () => void }) {
  const archived = !!item?.isArchived;
  const [form, setForm] = useState<ExpenseForm>(item ? formFromExpense(item) : emptyExpenseForm());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, error, submit } = useSubmit(onClose);
  const set = (key: keyof ExpenseForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const choosable: Person[] = x.summary.panelPersons.map((l) => l.person);
  const current = x.persons.find((p) => p.id === item?.personId);
  if (current && !choosable.some((p) => p.id === current.id)) choosable.push(current);

  const save = () => submit(() => {
    const parsed = parseExpenseForm(form);
    if ('error' in parsed) return parsed.error;
    return item ? x.editExpense(item.id, parsed.value) : x.addExpense(parsed.value);
  });

  return (
    <Sheet visible title={archived ? 'Archived expense' : item ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      {archived && item ? (
        <>
          <Text style={type.heading}>{item.label}</Text>
          <Text style={[type.amount, { fontSize: 20, marginVertical: space.sm }]}>{inr(item.amount)}</Text>
          <Text style={[type.small, { marginBottom: space.lg }]}>This expense is archived and not counted in totals.</Text>
        </>
      ) : (
        <>
          <Field label="Name" value={form.label} onChangeText={set('label')} placeholder="e.g. Electricity bill" />
          <Field label="Amount (₹)" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" placeholder="0" />
          <Select label="Category" options={CATEGORIES} value={form.category} onChange={set('category')} />
          {choosable.length > 0 && (
            <Select label="Paid by" options={[{ value: '', label: 'Nobody' }, ...choosable.map((p) => ({ value: p.id, label: p.name }))]} value={form.personId} onChange={set('personId')} />
          )}
          <Chips label="Status" options={[{ value: 'pending', label: 'Pending' }, { value: 'done', label: 'Paid' }]} value={form.status} onChange={set('status')} />
          <Field label="Notes (optional)" value={form.notes} onChangeText={set('notes')} multiline />
        </>
      )}
      <ErrorBanner message={error} />
      <View style={styles.actions}>
        {item && !archived && <Button label="Archive" variant="secondary" disabled={busy} onPress={() => submit(() => x.archiveExpense(item.id))} style={styles.grow} />}
        {item && archived && <Button label="Restore" disabled={busy} onPress={() => submit(() => x.restoreExpense(item.id))} style={styles.grow} />}
        {item && x.isAdmin && <Button label="Delete" variant="danger" disabled={busy} onPress={() => setConfirmDelete(true)} style={styles.grow} />}
        {!archived && <Button label="Save" loading={busy} onPress={save} style={styles.grow2} />}
      </View>
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete permanently?"
        message="This removes the expense for everyone and cannot be undone. Use Archive to keep a record."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); submit(() => x.deleteExpense(item!.id)); }}
      />
    </Sheet>
  );
}

// ── Other income ─────────────────────────────────────────────────────────────
export function IncomeSheet({ x, item, onClose }: { x: ExpensesApi; item?: Expense; onClose: () => void }) {
  const [label, setLabel] = useState(item?.label ?? `Income source ${x.otherIncome.length + 1}`);
  const [amount, setAmount] = useState(item ? String(Number(item.amount) || '') : '');
  const { busy, error, submit } = useSubmit(onClose);

  const save = () => submit(() => {
    const name = cleanLabel(label);
    if (!name) return 'Name is required.';
    const value = parseAmount(amount);
    if (value === null) return 'Enter a valid amount (numbers only).';
    return item ? x.editIncome(item.id, name, value) : x.addIncome(name, value);
  });

  return (
    <Sheet visible title={item ? 'Edit income source' : 'Add income source'} onClose={onClose}>
      <Field label="Name" value={label} onChangeText={setLabel} placeholder="e.g. Rent received" />
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <ErrorBanner message={error} />
      <View style={styles.actions}>
        {item && <Button label="Remove" variant="danger" disabled={busy} onPress={() => submit(() => x.removeIncome(item.id))} style={styles.grow} />}
        <Button label="Save" loading={busy} onPress={save} style={styles.grow2} />
      </View>
    </Sheet>
  );
}

// ── Salary / person ──────────────────────────────────────────────────────────
export function SalarySheet({ x, person, onClose }: { x: ExpensesApi; person: Person; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Number(x.salaryOf(person.id)) || ''));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { busy, error, submit } = useSubmit(onClose);
  const word = periodWord(x);

  return (
    <Sheet visible title={`${person.name} · salary`} onClose={onClose}>
      <Field label={`Salary for this ${word} (₹)`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
      <ErrorBanner message={error} />
      <View style={styles.actions}>
        <Button label={`Remove from ${word}`} variant="danger" disabled={busy} onPress={() => setConfirmRemove(true)} style={styles.grow} />
        <Button
          label="Save" loading={busy} style={styles.grow2}
          onPress={() => submit(() => {
            const value = parseAmount(amount);
            return value === null ? 'Enter a valid amount (numbers only).' : x.saveSalary(person.id, value);
          })}
        />
      </View>
      <ConfirmSheet
        visible={confirmRemove}
        title={`Remove ${person.name}?`}
        message={`${person.name} will no longer appear in this ${word}. Their expenses stay, and other ${word}s are not affected.`}
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => { setConfirmRemove(false); submit(() => x.removePerson(person.id)); }}
      />
    </Sheet>
  );
}

export function PersonSheet({ x, onClose }: { x: ExpensesApi; onClose: () => void }) {
  const [name, setName] = useState('');
  const [salary, setSalary] = useState('');
  const [color, setColor] = useState(PERSON_COLORS[x.persons.length % PERSON_COLORS.length]);
  const [panel, setPanel] = useState<'panel' | 'income'>('panel');
  const { busy, error, submit } = useSubmit(onClose);

  return (
    <Sheet visible title={`Add person to this ${periodWord(x)}`} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Hari" autoCapitalize="words" />
      <Field label="Salary (₹)" value={salary} onChangeText={setSalary} keyboardType="decimal-pad" placeholder="0" />
      <Chips
        label="Tracks their own expenses?"
        options={[{ value: 'panel', label: 'Yes, own expenses' }, { value: 'income', label: 'Income only' }]}
        value={panel}
        onChange={setPanel}
      />
      <Text style={[type.small, { fontWeight: '600', marginBottom: 6 }]}>Colour</Text>
      <View style={styles.swatches}>
        {PERSON_COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`} accessibilityState={{ selected: color === c }} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
        ))}
      </View>
      <ErrorBanner message={error} />
      <Button
        label="Add person" loading={busy}
        onPress={() => submit(() => {
          const n = cleanLabel(name);
          if (!n) return 'Name is required.';
          const s = parseAmount(salary);
          if (s === null) return 'Enter a valid salary (numbers only).';
          return x.addPerson({ name: n, color, salary: s, hasPanel: panel === 'panel' });
        })}
      />
    </Sheet>
  );
}

// ── Years and months ─────────────────────────────────────────────────────────
export type PeriodMode = 'year' | 'month' | 'renameYear' | 'renameMonth';

export function PeriodSheet({ x, mode, onClose }: { x: ExpensesApi; mode: PeriodMode; onClose: () => void }) {
  const initial = mode === 'renameYear' ? x.year?.label : mode === 'renameMonth' ? x.group?.label : '';
  const [label, setLabel] = useState(initial ?? '');
  const [monthly, setMonthly] = useState<'yes' | 'no'>('yes');
  const { busy, error, submit } = useSubmit(onClose);
  const isYear = mode === 'year' || mode === 'renameYear';
  const title = { year: 'Add year', month: 'Add month', renameYear: 'Rename year', renameMonth: 'Rename month' }[mode];

  const save = () => submit(() => {
    const text = cleanLabel(label);
    if (!text) return `${isYear ? 'Year' : 'Month'} name is required.`;
    if (mode === 'year') return x.addYear(text, monthly === 'yes');
    if (mode === 'month') return x.addMonth(text);
    return mode === 'renameYear' ? x.renameYear(text) : x.renameMonth(text);
  });

  return (
    <Sheet visible title={title} onClose={onClose}>
      <Field label={isYear ? 'Year' : 'Month'} value={label} onChangeText={setLabel} placeholder={isYear ? '2026' : 'e.g. Mar-2026'} />
      {mode === 'year' && (
        <Chips label="Break the year into months?" options={[{ value: 'yes', label: 'Yes, by month' }, { value: 'no', label: 'No, one list' }]} value={monthly} onChange={setMonthly} />
      )}
      <ErrorBanner message={error} />
      <Button label={mode.startsWith('rename') ? 'Save' : 'Add'} loading={busy} onPress={save} />
    </Sheet>
  );
}

// Everything that acts on the selected year / month, plus the "show archived" switch.
export function ManageSheet({ x, onClose, open }: { x: ExpensesApi; onClose: () => void; open: (mode: PeriodMode) => void }) {
  const [confirm, setConfirm] = useState<null | { title: string; message: string; label: string; run: () => Promise<string | null> }>(null);
  const [error, setError] = useState('');
  const year = x.year;
  const group = x.group;

  const go = async (run: () => Promise<string | null>) => {
    setConfirm(null);
    const result = await run();
    if (result) setError(result);
    else onClose();
  };
  const ask = (title: string, message: string, label: string, run: () => Promise<string | null>) => setConfirm({ title, message, label, run });

  return (
    <Sheet visible title="Manage" onClose={onClose}>
      <Chips
        label="Archived years and months"
        options={[{ value: 'hide', label: 'Hidden' }, { value: 'show', label: 'Shown' }]}
        value={x.showArchived ? 'show' : 'hide'}
        onChange={(v) => x.setShowArchived(v === 'show')}
      />
      <ErrorBanner message={error} />

      {year && (
        <View style={styles.block}>
          <Text style={type.caption}>Year · {year.label}{isArchivedPeriod(year) ? ' (archived)' : ''}</Text>
          {x.canWrite && <Button label="Rename year" variant="secondary" onPress={() => open('renameYear')} />}
          {x.isAdmin && (isArchivedPeriod(year)
            ? <Button label="Restore year" variant="secondary" onPress={() => go(() => x.restoreYear(year.id))} />
            : <Button label="Archive year" variant="secondary" onPress={() => ask(`Archive ${year.label}?`, 'It is hidden from the lists and can be restored from here.', 'Archive', x.archiveYear)} />)}
          {x.isAdmin && (
            <Button label="Delete year" variant="danger" onPress={() => ask(`Delete ${year.label}?`, 'All months, expenses and salaries in this year are permanently deleted. This cannot be undone.', 'Delete', x.deleteYear)} />
          )}
        </View>
      )}

      {year?.hasSubgroups && group && (
        <View style={styles.block}>
          <Text style={type.caption}>Month · {group.label}{isArchivedPeriod(group) ? ' (archived)' : ''}</Text>
          {x.canWrite && <Button label="Rename month" variant="secondary" onPress={() => open('renameMonth')} />}
          {x.isAdmin && (isArchivedPeriod(group)
            ? <Button label="Restore month" variant="secondary" onPress={() => go(() => x.restoreMonth(group.id))} />
            : <Button label="Archive month" variant="secondary" onPress={() => ask(`Archive ${group.label}?`, 'It is hidden from the lists and can be restored from here.', 'Archive', x.archiveMonth)} />)}
          {x.isAdmin && (
            <Button label="Delete month" variant="danger" onPress={() => ask(`Delete ${group.label}?`, 'All expenses and salaries in this month are permanently deleted. This cannot be undone.', 'Delete', x.deleteMonth)} />
          )}
        </View>
      )}

      {!x.canWrite && <Text style={type.small}>You have read-only access to this workspace.</Text>}

      <ConfirmSheet
        visible={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && go(confirm.run)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  grow: { flex: 1 },
  grow2: { flex: 2 },
  block: { gap: space.sm, marginBottom: space.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
});
