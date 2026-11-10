import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { daysUntil, inrCompact, toNumber } from '../format';
import { buildInsights, InsightTarget } from '../home/insights';
import { DEFAULT_LAYOUT, HomeLayout, SectionId, cleanLayout, moveSection, toggleSection, visibleSections } from '../home/layout';
import {
  Attention, attentionItems, banksTotal, categoryBreakdown, gainPercent, greeting, isCalendarMonth, monthStatus, netWorth, spentShare, unpaidBills,
} from '../home/logic';
import { setupComplete, setupSteps } from '../home/setup';
import { useHome } from '../home/useHome';
import { Reveal } from '../motion';
import type { Focus, Go } from '../navigation';
import { useSession } from '../session';
import { loadPrefs, savePrefs } from '../storage';
import { colors, space, type } from '../theme';
import { TourTarget, useTour } from '../tour/context';
import { Button, Card, ErrorBanner, IconButton, Screen } from '../ui';
import { CustomizeHomeSheet, InsightsCard, SetupCard } from './home/dynamic';
import { AttentionCard, CategoryCard, Hero, HomeSkeleton, MonthCard, QuickActions, Tile, TileGrid, TrendCard } from './home/parts';

const TARGET_ROUTE: Record<InsightTarget, Parameters<Go>> = {
  expenses: ['expenses'], insurance: ['more', { more: 'insurance' }], loans: ['loans'], analytics: ['more', { more: 'analytics' }],
};

export function HomeScreen({ go }: { go: Go }) {
  const { session, workspace } = useSession();
  const tour = useTour();
  const { data, loading, refreshing, error, reload } = useHome();
  const [hidden, setHidden] = useState(false);
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_LAYOUT);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => { loadPrefs().then((p) => setLayout(cleanLayout(p.homeLayout))); }, []);
  const changeLayout = (next: HomeLayout) => { setLayout(next); loadPrefs().then((p) => savePrefs({ ...p, homeLayout: next })); };

  const firstName = session?.user.name?.split(' ')[0] ?? '';
  const view = useMemo(() => {
    if (!data) return null;
    const { all, banks, policies, current, expenses, periods } = data;
    const now = new Date();
    const bankSum = banks ? banksTotal(banks) : 0;
    const bills = expenses ? unpaidBills(expenses) : [];
    const focus: Focus | undefined = current ? { yearId: current.yearId, groupId: current.groupId } : undefined;
    const income = toNumber(current?.totalIncome);
    const spent = toNumber(current?.totalExpenses);
    const live = (policies ?? []).filter((p) => !p.isArchived);
    const days = live.map((p) => ({ name: p.name, days: daysUntil(p.nextDueDate, now) })).filter((d): d is { name: string; days: number } => d.days !== null);
    const nextDues = days.map((d) => d.days).filter((d) => d >= 0);
    const slices = categoryBreakdown(expenses ?? []);
    const at = current ? periods.findIndex((p) => p.yearId === current.yearId && p.groupId === current.groupId) : -1;
    const previous = at > 0 ? periods[at - 1] : null;
    const steps = setupSteps(data);
    return {
      nw: netWorth(bankSum, toNumber(all?.currentValue), toNumber(all?.totalDebt)),
      hasWorth: !!(all || banks),
      bankSum, bills, focus,
      status: monthStatus(income, spent), share: spentShare(income, spent),
      unpaidTotal: bills.reduce((s, e) => s + toNumber(e.amount), 0),
      attention: attentionItems(bills, policies ?? []),
      slices,
      nextDue: nextDues.length ? Math.min(...nextDues) : null,
      gain: all ? gainPercent(all) : null,
      fresh: !data.current && (data.banks?.length ?? 0) === 0 && !toNumber(all?.totalInvested) && !toNumber(all?.totalDebt),
      steps,
      insights: buildInsights({
        hasMonth: !!current, thisMonth: isCalendarMonth(current, now), income, spent,
        unpaidCount: bills.length, unpaidTotal: bills.reduce((s, e) => s + toNumber(e.amount), 0),
        prevSpent: previous ? toNumber(previous.totalExpenses) : null, monthlyEmi: toNumber(all?.monthlyEmi),
        topCategory: slices[0] && slices[0].name !== 'other' ? { name: slices[0].name, share: slices[0].share } : null,
        dues: days.filter((d) => d.days <= 30), now,
      }),
    };
  }, [data]);

  const open = (to: InsightTarget) => go(...TARGET_ROUTE[to]);
  const openAttention = (item: Attention) => (item.kind === 'insurance' ? go('more', { more: 'insurance' }) : go('expenses', { focus: view?.focus }));

  const tiles: Tile[] = data && view ? [
    { key: 'banks', icon: 'briefcase', tone: 'primary', label: 'Bank balance', value: inrCompact(view.bankSum), note: data.banks ? `${data.banks.length} ${data.banks.length === 1 ? 'bank' : 'banks'}` : undefined, onPress: () => go('banks') },
    { key: 'invest', icon: 'trending-up', tone: 'info', label: 'Investments', value: inrCompact(data.all?.currentValue), note: view.gain === null ? undefined : `${view.gain >= 0 ? '+' : ''}${view.gain.toFixed(1)}% overall`, noteTone: (view.gain ?? 0) >= 0 ? 'positive' : 'negative', onPress: () => go('more', { more: 'investments' }) },
    { key: 'loans', icon: 'percent', tone: 'negative', label: 'Loan EMIs', value: `${inrCompact(data.all?.monthlyEmi)}/mo`, note: `${inrCompact(data.all?.totalDebt)} outstanding`, onPress: () => go('loans') },
    { key: 'insurance', icon: 'shield', tone: 'warning', label: 'Insurance', value: `${data.policies?.length ?? 0} ${data.policies?.length === 1 ? 'policy' : 'policies'}`, note: view.nextDue === null ? undefined : view.nextDue === 0 ? 'Premium due today' : `Next premium in ${view.nextDue}d`, onPress: () => go('more', { more: 'insurance' }) },
  ] : [];

  // Every dashboard section, by id. The order and visibility come from the saved layout.
  const sections: Partial<Record<SectionId, ReactNode>> = data && view ? {
    insights: view.insights.length > 0 && (
      <TourTarget id="home.insights"><InsightsCard insights={view.insights} onAction={open} /></TourTarget>
    ),
    setup: !setupComplete(view.steps) && (
      <SetupCard steps={view.steps} onOpen={(s) => go(s.route.tab, { more: s.route.more })} onTour={tour ? () => tour.start('full') : undefined} />
    ),
    worth: view.hasWorth && <TourTarget id="home.worth"><Hero nw={view.nw} hidden={hidden} onToggle={() => setHidden((h) => !h)} /></TourTarget>,
    actions: (
      <QuickActions actions={[
        { key: 'add', icon: 'plus', label: 'Add expense', onPress: () => go('expenses', { focus: view.focus }) },
        { key: 'banks', icon: 'briefcase', label: 'Banks', onPress: () => go('banks') },
        { key: 'loans', icon: 'percent', label: 'Loans', onPress: () => go('loans') },
        { key: 'ins', icon: 'shield', label: 'Insurance', onPress: () => go('more', { more: 'insurance' }) },
      ]} />
    ),
    month: data.current && (
      <MonthCard
        period={data.current} status={view.status} share={view.share}
        unpaidCount={view.bills.length} unpaidTotal={view.unpaidTotal}
        onOpen={() => go('expenses', { focus: view.focus })}
      />
    ),
    attention: (data.expenses || data.policies) && (
      <View>
        <SectionLabel>Needs your attention</SectionLabel>
        <AttentionCard items={view.attention} onOpen={openAttention} />
      </View>
    ),
    trend: data.trend.length > 0 && <TrendCard periods={data.trend} currentId={data.current ? data.current.groupId ?? data.current.yearId : null} />,
    categories: view.slices.length > 0 && <CategoryCard slices={view.slices} />,
    tiles: (
      <View>
        <SectionLabel>Your money at a glance</SectionLabel>
        <TileGrid tiles={tiles} />
      </View>
    ),
  } : {};

  const shown = visibleSections(layout).filter((id) => sections[id]);

  return (
    <Screen
      tour="home"
      title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
      subtitle={workspace?.name}
      refreshing={refreshing}
      onRefresh={reload}
      right={(
        <View style={styles.headerRight}>
          <TourTarget id="home.customize">
            <IconButton icon="sliders" label="Customize dashboard" onPress={() => setCustomizing(true)} />
          </TourTarget>
          <Pressable onPress={() => go('more')} accessibilityRole="button" accessibilityLabel="Open profile and settings" style={styles.avatar}>
            <Text style={styles.avatarLabel}>{firstName[0]?.toUpperCase() ?? '?'}</Text>
          </Pressable>
        </View>
      )}
    >
      <ErrorBanner message={error} onRetry={reload} />
      {data && data.failed > 0 && <ErrorBanner message="Some sections could not be loaded. Pull down to refresh." />}

      {loading ? <HomeSkeleton /> : data && view && (
        <>
          {view.fresh ? (
            <>
              <Reveal index={0}>
                <Card>
                  <View style={styles.welcomeIcon}><Feather name="compass" size={26} color={colors.primary} /></View>
                  <Text style={type.heading}>Let's set up your household</Text>
                  <Text style={[type.small, { marginTop: 4, marginBottom: space.lg }]}>Add a year and your first expenses, then your banks and loans. Your dashboard fills in as you go.</Text>
                  <Button label="Start with expenses" icon="arrow-right" onPress={() => go('expenses')} />
                </Card>
              </Reveal>
              {sections.setup && <Reveal index={1}>{sections.setup}</Reveal>}
            </>
          ) : shown.map((id, i) => <Reveal key={id} index={i}>{sections[id]}</Reveal>)}
          {!view.fresh && shown.length === 0 && (
            <Card><Text style={type.small}>Every section is hidden. Tap the sliders icon at the top to show some again.</Text></Card>
          )}
        </>
      )}

      {customizing && (
        <CustomizeHomeSheet
          layout={layout}
          onToggle={(id) => changeLayout(toggleSection(layout, id))}
          onMove={(id, delta) => changeLayout(moveSection(layout, id, delta))}
          onReset={() => changeLayout(DEFAULT_LAYOUT)}
          onClose={() => setCustomizing(false)}
        />
      )}
    </Screen>
  );
}

const SectionLabel = ({ children }: { children: string }) => <Text style={[type.caption, { marginBottom: space.sm }]}>{children}</Text>;

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  welcomeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
