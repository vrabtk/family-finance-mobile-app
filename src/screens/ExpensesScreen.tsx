import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { UNASSIGNED, isArchivedPeriod, pct } from '../expenses/logic';
import { useExpenses } from '../expenses/useExpenses';
import { inr, inrCompact } from '../format';
import type { Focus } from '../navigation';
import { colors, radius, space, type } from '../theme';
import type { Expense, Person } from '../types';
import { Badge, Button, Card, Chips, Empty, ErrorBanner, Fab, IconButton, Loading, ProgressBar, Screen, SectionTitle } from '../ui';
import { ExpenseSheet, IncomeSheet, ManageSheet, PeriodMode, PeriodSheet, PersonSheet, SalarySheet } from './expenses/sheets';

type Panel =
  | { k: 'expense'; item?: Expense }
  | { k: 'income'; item?: Expense }
  | { k: 'salary'; person: Person }
  | { k: 'person' }
  | { k: 'period'; mode: PeriodMode }
  | { k: 'manage' }
  | null;

export function ExpensesScreen({ focus }: { focus?: Focus }) {
  const x = useExpenses(focus);
  const [panel, setPanel] = useState<Panel>(null);
  // People and Other income can be folded away so the expense list is reachable without a long scroll.
  const [folded, setFolded] = useState({ people: false, income: false });
  const fold = (key: 'people' | 'income', title: string) => (
    <IconButton icon={folded[key] ? 'chevron-down' : 'chevron-up'} label={`${folded[key] ? 'Show' : 'Hide'} ${title}`} onPress={() => setFolded((f) => ({ ...f, [key]: !f[key] }))} />
  );
  const close = () => setPanel(null);
  const { summary: s } = x;
  const word = x.year?.hasSubgroups ? 'month' : 'year';
  const ready = !!x.scope;
  const empty = x.spending.length === 0;

  const periodLabel = (p: { label: string; status?: string }) => (isArchivedPeriod(p) ? `${p.label} (archived)` : p.label);

  return (
    <Screen
      title="Expenses"
      subtitle={x.year ? `${x.year.label}${x.group ? ` · ${x.group.label}` : ''}` : undefined}
      refreshing={x.refreshing}
      onRefresh={x.reload}
      right={<IconButton icon="sliders" label="Manage years and months" onPress={() => setPanel({ k: 'manage' })} />}
      fab={x.canWrite && ready ? <Fab onPress={() => setPanel({ k: 'expense' })} label="Add expense" /> : undefined}
    >
      <ErrorBanner message={x.error} onRetry={x.reload} />
      <ErrorBanner message={x.actionError} />

      {x.loading ? <Loading /> : (
        <>
          {x.years.length > 0 && (
            <Chips options={x.years.map((y) => ({ value: y.id, label: periodLabel(y) }))} value={x.year?.id ?? ''} onChange={x.selectYear} />
          )}
          {x.year?.hasSubgroups && x.groups.length > 0 && (
            <Chips options={x.groups.map((g) => ({ value: g.id, label: periodLabel(g) }))} value={x.group?.id ?? ''} onChange={x.selectMonth} />
          )}
          {x.canWrite && (
            <View style={styles.inline}>
              <Button label="Add year" icon="plus" small variant="secondary" onPress={() => setPanel({ k: 'period', mode: 'year' })} />
              {x.year?.hasSubgroups && <Button label="Add month" icon="plus" small variant="secondary" onPress={() => setPanel({ k: 'period', mode: 'month' })} />}
            </View>
          )}

          {!x.year ? (
            <Empty icon="calendar" title="No year yet" hint={x.canWrite ? 'Add a year to start tracking expenses.' : 'Ask a workspace member to add a year.'} />
          ) : !ready ? (
            <Empty icon="calendar" title="No month yet" hint={x.canWrite ? 'Add a month for this year.' : 'Ask a workspace member to add a month.'} />
          ) : x.scopeLoading ? <Loading /> : (
            <>
              {/* Summary */}
              <Card>
                <Text style={type.caption}>{s.balance >= 0 ? 'Left after expenses' : 'Over budget'}</Text>
                <Text style={[styles.balance, { color: s.balance >= 0 ? colors.positive : colors.negative }]} numberOfLines={1} adjustsFontSizeToFit>{inr(Math.abs(s.balance))}</Text>
                <View style={styles.split}>
                  <Figure label="Income" value={inrCompact(s.incomeTotal)} />
                  <Figure label="Spending" value={inrCompact(s.spentTotal)} />
                  <Figure label="Unpaid" value={inrCompact(s.unpaidTotal)} tone={s.unpaidTotal > 0 ? colors.warning : undefined} />
                </View>
                <ProgressBar value={s.paidPct / 100} tone="positive" />
                <Text style={[type.small, { marginTop: 6 }]}>{s.items ? `${s.paidItems} of ${s.items} items paid (${s.paidPct}%)` : 'Nothing to pay yet'}</Text>
              </Card>

              {/* People */}
              <SectionTitle action={fold('people', 'people')}>People</SectionTitle>
              {!folded.people && <Card style={{ padding: 0 }}>
                {s.panelPersons.length === 0 && s.incomeOnly.length === 0 && <Text style={[type.small, styles.pad]}>No people in this {word} yet.</Text>}
                {s.panelPersons.map((l, i) => (
                  <Pressable key={l.person.id} disabled={!x.canWrite} onPress={() => setPanel({ k: 'salary', person: l.person })} style={[styles.person, i > 0 && styles.divider]} accessibilityRole="button" accessibilityLabel={`${l.person.name} salary`}>
                    <View style={styles.personTop}>
                      <View style={[styles.dot, { backgroundColor: l.person.color || colors.primary }]} />
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{l.person.name}</Text>
                      <Text style={[type.amount, { color: l.remaining >= 0 ? colors.positive : colors.negative }]}>{inr(l.remaining)}</Text>
                    </View>
                    <Text style={type.small}>Salary {inr(l.salary)} · spent {inr(l.spent)} · {l.paidItems}/{l.items} paid</Text>
                    <ProgressBar value={pct(l.spent, l.salary) / 100} tone={l.spent > l.salary ? 'negative' : 'primary'} />
                  </Pressable>
                ))}
                {s.incomeOnly.map(({ person, salary }, i) => (
                  <Pressable key={person.id} disabled={!x.canWrite} onPress={() => setPanel({ k: 'salary', person })} style={[styles.person, (i > 0 || s.panelPersons.length > 0) && styles.divider]} accessibilityRole="button" accessibilityLabel={`${person.name} salary`}>
                    <View style={styles.personTop}>
                      <View style={[styles.dot, { backgroundColor: person.color || colors.primary }]} />
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{person.name}</Text>
                      <Text style={[type.amount, { color: colors.positive }]}>{inr(salary)}</Text>
                    </View>
                    <Text style={type.small}>Income only</Text>
                  </Pressable>
                ))}
                {s.unassigned.items > 0 && (
                  <View style={[styles.person, styles.divider]}>
                    <View style={styles.personTop}>
                      <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                      <Text style={[type.body, { flex: 1 }]}>Unassigned</Text>
                      <Text style={[type.amount, { color: colors.warning }]}>{inr(s.unassigned.total)}</Text>
                    </View>
                    <Text style={type.small}>{s.unassigned.items} {s.unassigned.items === 1 ? 'expense' : 'expenses'} not tied to a person</Text>
                  </View>
                )}
                {x.canWrite && <AddRow label="Add person" onPress={() => setPanel({ k: 'person' })} divider />}
              </Card>}

              {/* Other income */}
              <SectionTitle action={fold('income', 'other income')}>Other income</SectionTitle>
              {!folded.income && <Card style={{ padding: 0 }}>
                {x.otherIncome.length === 0 && <Text style={[type.small, styles.pad]}>No other income this {word}.</Text>}
                {x.otherIncome.map((e, i) => (
                  <Pressable key={e.id} disabled={!x.canWrite} onPress={() => setPanel({ k: 'income', item: e })} style={[styles.incomeRow, i > 0 && styles.divider]} accessibilityRole="button" accessibilityLabel={`Income ${e.label}`}>
                    <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{e.label}</Text>
                    <Text style={[type.amount, { color: colors.positive }]}>{inr(e.amount)}</Text>
                  </Pressable>
                ))}
                {x.canWrite && <AddRow label="Add other income" onPress={() => setPanel({ k: 'income' })} divider />}
              </Card>}

              {/* Expenses */}
              <SectionTitle>Expenses</SectionTitle>
              {!empty && (
                <>
                  <View style={styles.search}>
                    <Feather name="search" size={16} color={colors.muted} />
                    <TextInput
                      value={x.filter.query}
                      onChangeText={(query) => x.setFilter((f) => ({ ...f, query }))}
                      placeholder="Search expenses"
                      placeholderTextColor={colors.muted}
                      accessibilityLabel="Search expenses"
                      style={styles.searchInput}
                      autoCorrect={false}
                    />
                    {!!x.filter.query && (
                      <Pressable onPress={() => x.setFilter((f) => ({ ...f, query: '' }))} hitSlop={10} accessibilityLabel="Clear search"><Feather name="x" size={16} color={colors.muted} /></Pressable>
                    )}
                  </View>
                  <Chips options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'done', label: 'Paid' }]} value={x.filter.status} onChange={(status) => x.setFilter((f) => ({ ...f, status }))} />
                  {s.panelPersons.length > 0 && (
                    <Chips
                      options={[{ value: '', label: 'Everyone' }, ...s.panelPersons.map((l) => ({ value: l.person.id, label: l.person.name })), ...(s.unassigned.items ? [{ value: UNASSIGNED, label: 'Unassigned' }] : [])]}
                      value={x.filter.personId}
                      onChange={(personId) => x.setFilter((f) => ({ ...f, personId }))}
                    />
                  )}
                </>
              )}

              {x.visible.length === 0 ? (
                <Empty
                  icon="shopping-bag"
                  title={empty ? 'No expenses yet' : 'No matching expenses'}
                  hint={empty ? (x.canWrite ? 'Tap + to add your first expense.' : undefined) : 'Try a different search or filter.'}
                />
              ) : x.visible.map((e) => (
                <Card key={e.id} style={{ padding: space.md, opacity: e.isArchived ? 0.6 : 1 }} onPress={x.canWrite ? () => setPanel({ k: 'expense', item: e }) : undefined}>
                  <View style={styles.expenseRow}>
                    <Pressable
                      onPress={x.canWrite && !e.isArchived ? () => x.toggleStatus(e) : undefined}
                      hitSlop={10}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: e.status === 'done', disabled: !x.canWrite || !!e.isArchived }}
                      accessibilityLabel={`Mark ${e.label} ${e.status === 'done' ? 'pending' : 'paid'}`}
                    >
                      <View style={[styles.check, e.status === 'done' && styles.checkOn]}>{e.status === 'done' && <Feather name="check" size={14} color={colors.onPrimary} />}</View>
                    </Pressable>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.body, e.status === 'done' && styles.struck]} numberOfLines={1}>{e.label}</Text>
                      <Text style={type.small} numberOfLines={1}>{[x.personName(e.personId), e.category && e.category !== 'other' ? e.category : null].filter(Boolean).join(' · ') || 'General'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[type.amount, { fontSize: 16 }]}>{inr(e.amount)}</Text>
                      {e.isArchived ? <Badge label="Archived" tone="neutral" /> : <Badge label={e.status === 'done' ? 'Paid' : 'Pending'} tone={e.status === 'done' ? 'positive' : 'warning'} />}
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {panel?.k === 'expense' && <ExpenseSheet x={x} item={panel.item} onClose={close} />}
      {panel?.k === 'income' && <IncomeSheet x={x} item={panel.item} onClose={close} />}
      {panel?.k === 'salary' && <SalarySheet x={x} person={panel.person} onClose={close} />}
      {panel?.k === 'person' && <PersonSheet x={x} onClose={close} />}
      {panel?.k === 'period' && <PeriodSheet x={x} mode={panel.mode} onClose={close} />}
      {panel?.k === 'manage' && <ManageSheet x={x} onClose={close} open={(mode) => setPanel({ k: 'period', mode })} />}
    </Screen>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View>
      <Text style={type.caption}>{label}</Text>
      <Text style={[type.amount, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function AddRow({ label, onPress, divider }: { label: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.addRow, divider && styles.divider]} accessibilityRole="button">
      <Feather name="plus" size={16} color={colors.primary} />
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', gap: space.sm },
  balance: { fontSize: 32, fontWeight: '800', marginTop: 4, marginBottom: space.md, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  pad: { padding: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  person: { padding: space.lg, gap: 6 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingVertical: space.md },
  addLabel: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: space.md },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.positive, borderColor: colors.positive },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
});
