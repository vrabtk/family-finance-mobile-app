import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RANGES, Range, barHeights, byYear, extremes, shares, totals, windowOf } from '../analytics/logic';
import { getAnalyticsAllTime, getAnalyticsMonthly } from '../api';
import { inr, inrCompact } from '../format';
import { shortLabel } from '../home/logic';
import { useAsync } from '../hooks';
import { useSession } from '../session';
import { TourTarget } from '../tour/context';
import { colors, radius, space, type } from '../theme';
import { Card, Chips, Empty, ErrorBanner, Loading, ProgressBar, Screen, SectionTitle, Stat } from '../ui';

export function AnalyticsScreen({ onBack }: { onBack?: () => void }) {
  const { workspace } = useSession();
  const wid = workspace?.id ?? '';
  const { data, loading, refreshing, error, reload } = useAsync(async () => {
    const [all, monthly] = await Promise.all([getAnalyticsAllTime(wid), getAnalyticsMonthly(wid)]);
    return { all, monthly };
  }, [wid]);
  const [range, setRange] = useState<Range>('12');

  const periods = windowOf(data?.monthly ?? [], range);
  const t = totals(periods);
  const bars = barHeights(periods);
  const years = byYear(data?.monthly ?? []);
  const { highestSpend, bestSurplus } = extremes(periods);
  const cats = shares(data?.all.topCategories ?? []);
  const all = data?.all;

  return (
    <Screen tour="analytics" title="Analytics" subtitle="Income, spending and savings over time" onBack={onBack} refreshing={refreshing} onRefresh={reload}>
      <ErrorBanner message={error} onRetry={reload} />
      {loading ? <Loading /> : !data ? null : data.monthly.length === 0 ? (
        <Empty icon="bar-chart-2" title="Nothing to analyse yet" hint="Add a year and some expenses, and the charts appear here." />
      ) : (
        <>
          <TourTarget id="an.range"><Chips options={RANGES} value={range} onChange={setRange} /></TourTarget>

          <View style={styles.tiles}>
            <Stat label="Income" value={inrCompact(t.income)} tone="positive" icon="arrow-down-left" />
            <Stat label="Spending" value={inrCompact(t.spending)} tone="negative" icon="arrow-up-right" />
            <Stat label={t.surplus >= 0 ? 'Saved' : 'Overspent'} value={inrCompact(Math.abs(t.surplus))} tone={t.surplus >= 0 ? 'primary' : 'warning'} icon="pocket" />
            <Stat label="Savings rate" value={t.savingsRate === null ? '–' : `${t.savingsRate}%`} tone="info" icon="percent" />
          </View>

          <SectionTitle>Month by month</SectionTitle>
          <Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart} accessibilityLabel="Income and spending chart">
              {periods.map((p, i) => (
                <View key={`${p.yearId}:${p.groupId}`} style={styles.col}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, { height: Math.max(2, bars[i].income * 100), backgroundColor: colors.positive }]} />
                    <View style={[styles.bar, { height: Math.max(2, bars[i].spending * 100), backgroundColor: colors.warning }]} />
                  </View>
                  <Text style={styles.colLabel} numberOfLines={1}>{shortLabel(p.label)}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.legend}>
              <Legend color={colors.positive} label="Income" />
              <Legend color={colors.warning} label="Spending" />
            </View>
            {t.months > 0 && <Text style={[type.small, { marginTop: space.sm }]}>Average spending {inr(t.avgSpending)} a month over {t.months} {t.months === 1 ? 'month' : 'months'}.</Text>}
          </Card>

          {(highestSpend || bestSurplus) && (
            <Card>
              {highestSpend && <Fact label="Highest spending" period={highestSpend.label} value={inr(highestSpend.totalExpenses)} />}
              {bestSurplus && <Fact label="Best month for saving" period={bestSurplus.label} value={inr(Number(bestSurplus.totalIncome) - Number(bestSurplus.totalExpenses))} />}
            </Card>
          )}

          {years.length > 0 && (
            <>
              <SectionTitle>By year</SectionTitle>
              <Card style={{ padding: 0 }}>
                {years.map((y, i) => (
                  <View key={y.label} style={[styles.yearRow, i > 0 && styles.divider]}>
                    <Text style={[type.body, { flex: 1 }]}>{y.label}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[type.amount, { fontSize: 15, color: y.surplus >= 0 ? colors.positive : colors.negative }]}>{y.surplus >= 0 ? '+' : '−'}{inr(Math.abs(y.surplus))}</Text>
                      <Text style={type.small}>in {inrCompact(y.income)} · out {inrCompact(y.spending)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {cats.length > 0 && (
            <>
              <SectionTitle>Where the money goes</SectionTitle>
              <Card>
                {cats.map((c) => (
                  <View key={c.name} style={{ marginBottom: space.md }}>
                    <View style={styles.catTop}>
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{c.name[0].toUpperCase() + c.name.slice(1)}</Text>
                      <Text style={type.amount}>{inr(c.total)}</Text>
                    </View>
                    <ProgressBar value={c.share} tone="primary" />
                    <Text style={type.small}>{Math.round(c.share * 100)}%</Text>
                  </View>
                ))}
                <Text style={type.small}>Top categories across all time.</Text>
              </Card>
            </>
          )}

          {all && (
            <>
              <SectionTitle>Investments and loans</SectionTitle>
              <View style={styles.tiles}>
                <Stat label="Invested" value={inrCompact(all.totalInvested)} tone="info" icon="trending-up" />
                <Stat label={all.investmentGain >= 0 ? 'Gain' : 'Loss'} value={inrCompact(Math.abs(all.investmentGain))} tone={all.investmentGain >= 0 ? 'positive' : 'negative'} icon="activity" />
                <Stat label="Loans outstanding" value={inrCompact(all.totalDebt)} tone="negative" icon="percent" />
                <Stat label="EMIs a month" value={inrCompact(all.monthlyEmi)} tone="warning" icon="calendar" />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: color }]} /><Text style={type.small}>{label}</Text></View>
);

const Fact = ({ label, period, value }: { label: string; period: string; value: string }) => (
  <View style={styles.fact}>
    <View style={{ flex: 1 }}>
      <Text style={type.small}>{label}</Text>
      <Text style={type.body}>{period}</Text>
    </View>
    <Text style={type.amount}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  chart: { alignItems: 'flex-end', gap: space.md, paddingVertical: space.sm },
  col: { alignItems: 'center', width: 44 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 104 },
  bar: { width: 16, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  colLabel: { fontSize: 10, color: colors.muted, marginTop: 4 },
  legend: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  fact: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs },
  yearRow: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
});
