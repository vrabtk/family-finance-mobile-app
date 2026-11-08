import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { daysUntil, inrCompact, toNumber } from '../format';
import {
  Attention, attentionItems, banksTotal, categoryBreakdown, gainPercent, greeting, monthStatus, netWorth, spentShare, unpaidBills,
} from '../home/logic';
import { useHome } from '../home/useHome';
import { Reveal } from '../motion';
import type { Focus, Go } from '../navigation';
import { useSession } from '../session';
import { colors, space, type } from '../theme';
import { Button, Card, ErrorBanner, Screen } from '../ui';
import { AttentionCard, CategoryCard, Hero, HomeSkeleton, MonthCard, QuickActions, Tile, TileGrid, TrendCard } from './home/parts';

export function HomeScreen({ go }: { go: Go }) {
  const { session, workspace } = useSession();
  const { data, loading, refreshing, error, reload } = useHome();
  const [hidden, setHidden] = useState(false);

  const firstName = session?.user.name?.split(' ')[0] ?? '';
  const view = useMemo(() => {
    if (!data) return null;
    const { all, banks, policies, current, expenses } = data;
    const bankSum = banks ? banksTotal(banks) : 0;
    const bills = expenses ? unpaidBills(expenses) : [];
    const focus: Focus | undefined = current ? { yearId: current.yearId, groupId: current.groupId } : undefined;
    const income = toNumber(current?.totalIncome);
    const spent = toNumber(current?.totalExpenses);
    const dues = (policies ?? []).map((p) => daysUntil(p.nextDueDate)).filter((d): d is number => d !== null && d >= 0);
    return {
      nw: netWorth(bankSum, toNumber(all?.currentValue), toNumber(all?.totalDebt)),
      hasWorth: !!(all || banks),
      bankSum, bills, focus,
      status: monthStatus(income, spent), share: spentShare(income, spent),
      unpaidTotal: bills.reduce((s, e) => s + toNumber(e.amount), 0),
      attention: attentionItems(bills, policies ?? []),
      slices: categoryBreakdown(expenses ?? []),
      nextDue: dues.length ? Math.min(...dues) : null,
      gain: all ? gainPercent(all) : null,
      fresh: !data.current && (data.banks?.length ?? 0) === 0 && !toNumber(all?.totalInvested) && !toNumber(all?.totalDebt),
    };
  }, [data]);

  const openAttention = (item: Attention) => (item.kind === 'insurance' ? go('more', { more: 'insurance' }) : go('expenses', { focus: view?.focus }));

  const tiles: Tile[] = data && view ? [
    { key: 'banks', icon: 'briefcase', tone: 'primary', label: 'Bank balance', value: inrCompact(view.bankSum), note: data.banks ? `${data.banks.length} ${data.banks.length === 1 ? 'bank' : 'banks'}` : undefined, onPress: () => go('banks') },
    { key: 'invest', icon: 'trending-up', tone: 'info', label: 'Investments', value: inrCompact(data.all?.currentValue), note: view.gain === null ? undefined : `${view.gain >= 0 ? '+' : ''}${view.gain.toFixed(1)}% overall`, noteTone: (view.gain ?? 0) >= 0 ? 'positive' : 'negative', onPress: () => go('more', { more: 'investments' }) },
    { key: 'loans', icon: 'percent', tone: 'negative', label: 'Loan EMIs', value: `${inrCompact(data.all?.monthlyEmi)}/mo`, note: `${inrCompact(data.all?.totalDebt)} outstanding`, onPress: () => go('loans') },
    { key: 'insurance', icon: 'shield', tone: 'warning', label: 'Insurance', value: `${data.policies?.length ?? 0} ${data.policies?.length === 1 ? 'policy' : 'policies'}`, note: view.nextDue === null ? undefined : view.nextDue === 0 ? 'Premium due today' : `Next premium in ${view.nextDue}d`, onPress: () => go('more', { more: 'insurance' }) },
  ] : [];

  return (
    <Screen
      title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
      subtitle={workspace?.name}
      refreshing={refreshing}
      onRefresh={reload}
      right={(
        <Pressable onPress={() => go('more')} accessibilityRole="button" accessibilityLabel="Open profile and settings" style={styles.avatar}>
          <Text style={styles.avatarLabel}>{firstName[0]?.toUpperCase() ?? '?'}</Text>
        </Pressable>
      )}
    >
      <ErrorBanner message={error} onRetry={reload} />
      {data && data.failed > 0 && <ErrorBanner message="Some sections could not be loaded. Pull down to refresh." />}

      {loading ? <HomeSkeleton /> : data && view && (
        <>
          {view.fresh ? (
            <Reveal index={0}>
              <Card>
                <View style={styles.welcomeIcon}><Feather name="compass" size={26} color={colors.primary} /></View>
                <Text style={type.heading}>Let's set up your household</Text>
                <Text style={[type.small, { marginTop: 4, marginBottom: space.lg }]}>Add a year and your first expenses, then your banks and loans. Your dashboard fills in as you go.</Text>
                <Button label="Start with expenses" icon="arrow-right" onPress={() => go('expenses')} />
              </Card>
            </Reveal>
          ) : (
            <>
              {view.hasWorth && <Reveal index={0}><Hero nw={view.nw} hidden={hidden} onToggle={() => setHidden((h) => !h)} /></Reveal>}

              <Reveal index={1}>
                <QuickActions actions={[
                  { key: 'add', icon: 'plus', label: 'Add expense', onPress: () => go('expenses', { focus: view.focus }) },
                  { key: 'banks', icon: 'briefcase', label: 'Banks', onPress: () => go('banks') },
                  { key: 'loans', icon: 'percent', label: 'Loans', onPress: () => go('loans') },
                  { key: 'ins', icon: 'shield', label: 'Insurance', onPress: () => go('more', { more: 'insurance' }) },
                ]} />
              </Reveal>

              {data.current && (
                <Reveal index={2}>
                  <MonthCard
                    period={data.current} status={view.status} share={view.share}
                    unpaidCount={view.bills.length} unpaidTotal={view.unpaidTotal}
                    onOpen={() => go('expenses', { focus: view.focus })}
                  />
                </Reveal>
              )}

              {(data.expenses || data.policies) && (
                <Reveal index={3}>
                  <SectionLabel>Needs your attention</SectionLabel>
                  <AttentionCard items={view.attention} onOpen={openAttention} />
                </Reveal>
              )}

              {data.trend.length > 0 && (
                <Reveal index={4}><TrendCard periods={data.trend} currentId={data.current ? data.current.groupId ?? data.current.yearId : null} /></Reveal>
              )}

              {view.slices.length > 0 && <Reveal index={5}><CategoryCard slices={view.slices} /></Reveal>}

              <Reveal index={6}>
                <SectionLabel>Your money at a glance</SectionLabel>
                <TileGrid tiles={tiles} />
              </Reveal>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const SectionLabel = ({ children }: { children: string }) => <Text style={[type.caption, { marginBottom: space.sm }]}>{children}</Text>;

const styles = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  welcomeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
