import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MonthStatus, CategorySlice, Attention, NetWorth } from '../../home/logic';
import { inr, inrCompact } from '../../format';
import { Pulse, useReveal } from '../../motion';
import { colors, radius, shadow, space, type } from '../../theme';
import type { AnalyticsPeriod } from '../../types';
import { shortLabel } from '../../home/logic';
import { Badge, Card, IconName, Tone } from '../../ui';

// ── numbers that count up ────────────────────────────────────────────────────
// The visible text animates; the accessibility label always carries the final value.
export function AnimatedAmount({ value, style, mask, compact }: { value: number; style?: object; mask?: boolean; compact?: boolean }) {
  const t = useReveal(1100);
  const format = compact ? inrCompact : inr;
  return (
    <Text style={style} accessibilityLabel={mask ? 'Net worth hidden' : format(value)} numberOfLines={1} adjustsFontSizeToFit>
      {mask ? '₹ ••••••' : format(value * t)}
    </Text>
  );
}

// ── hero: net worth ──────────────────────────────────────────────────────────
export function Hero({ nw, hidden, onToggle }: { nw: NetWorth; hidden: boolean; onToggle: () => void }) {
  const total = Math.max(1, nw.assets + nw.debt);
  const t = useReveal(1000, 200);
  const seg = (v: number) => ({ flex: Math.max(0.0001, (v / total) * t) });
  return (
    <LinearGradient colors={['#0F766E', '#115E59', '#134E4A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroBlobA} />
      <View style={styles.heroBlobB} />
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>NET WORTH</Text>
        <Pressable onPress={onToggle} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Show net worth' : 'Hide net worth'}>
          <Feather name={hidden ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
      <AnimatedAmount value={nw.total} mask={hidden} style={styles.heroValue} />
      <View style={styles.heroBar}>
        <View style={[seg(nw.banks), { backgroundColor: '#99F6E4' }]} />
        <View style={[seg(nw.investments), { backgroundColor: '#FFFFFF' }]} />
        <View style={[seg(nw.debt), { backgroundColor: '#FCA5A5' }]} />
      </View>
      <View style={styles.heroRow}>
        <HeroStat dot="#99F6E4" label="Banks" value={hidden ? '••••' : inrCompact(nw.banks)} />
        <HeroStat dot="#FFFFFF" label="Investments" value={hidden ? '••••' : inrCompact(nw.investments)} />
        <HeroStat dot="#FCA5A5" label="Debt" value={hidden ? '••••' : inrCompact(nw.debt)} />
      </View>
    </LinearGradient>
  );
}

const HeroStat = ({ dot, label, value }: { dot: string; label: string; value: string }) => (
  <View style={{ flex: 1 }}>
    <View style={styles.heroStatLabel}><View style={[styles.dot, { backgroundColor: dot }]} /><Text style={styles.heroStatCaption}>{label}</Text></View>
    <Text style={styles.heroStatValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ── ring gauge ───────────────────────────────────────────────────────────────
export function Ring({ share, color, size = 132, stroke = 14, children }: { share: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const t = useReveal(1100, 150);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, share)) * t;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {dash > 0.5 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c}`} fill="none" />}
      </Svg>
      {children}
    </View>
  );
}

// ── this month ───────────────────────────────────────────────────────────────
const STATUS: Record<MonthStatus, { label: string; tone: Tone; color: string }> = {
  good: { label: 'On track', tone: 'positive', color: colors.positive },
  watch: { label: 'Watch spending', tone: 'warning', color: colors.warning },
  over: { label: 'Over budget', tone: 'negative', color: colors.negative },
  empty: { label: 'No data yet', tone: 'neutral', color: colors.muted },
};

// "Nov" + year 2026 -> "Nov · 2026", but "Nov-2026" already has the year, so leave it alone.
const periodTitle = (p: AnalyticsPeriod) => (p.groupId && p.yearLabel && !p.label.includes(p.yearLabel) ? `${p.label} · ${p.yearLabel}` : p.label);

export function MonthCard({ period, status, share, unpaidCount, unpaidTotal, onOpen }: {
  period: AnalyticsPeriod; status: MonthStatus; share: number; unpaidCount: number; unpaidTotal: number; onOpen: () => void;
}) {
  const s = STATUS[status];
  const income = Number(period.totalIncome) || 0;
  const spent = Number(period.totalExpenses) || 0;
  const left = income - spent;
  return (
    <Card onPress={onOpen}>
      <View style={styles.monthHead}>
        <View>
          <Text style={type.caption}>This month</Text>
          <Text style={type.heading}>{periodTitle(period)}</Text>
        </View>
        <Badge label={s.label} tone={s.tone} />
      </View>
      <View style={styles.monthBody}>
        <Ring share={share} color={s.color}>
          <Text style={styles.ringPct}>{Math.round(share * 100)}%</Text>
          <Text style={type.small}>spent</Text>
        </Ring>
        <View style={{ flex: 1, gap: space.md }}>
          <View>
            <Text style={type.caption}>{left >= 0 ? 'Left to spend' : 'Over by'}</Text>
            <AnimatedAmount value={Math.abs(left)} compact style={[styles.monthLeft, { color: left >= 0 ? colors.positive : colors.negative }]} />
          </View>
          <View style={styles.monthPair}>
            <View><Text style={type.caption}>Income</Text><Text style={type.amount}>{inrCompact(income)}</Text></View>
            <View><Text style={type.caption}>Spent</Text><Text style={type.amount}>{inrCompact(spent)}</Text></View>
          </View>
        </View>
      </View>
      {unpaidCount > 0 && (
        <View style={styles.unpaid}>
          <Feather name="clock" size={14} color={colors.warning} />
          <Text style={styles.unpaidText}>{unpaidCount} unpaid {unpaidCount === 1 ? 'bill' : 'bills'} · {inrCompact(unpaidTotal)} still to pay</Text>
        </View>
      )}
    </Card>
  );
}

// ── trend ────────────────────────────────────────────────────────────────────
const CHART_H = 112;

export function TrendCard({ periods, currentId }: { periods: AnalyticsPeriod[]; currentId: string | null }) {
  const t = useReveal(900, 250);
  const max = Math.max(1, ...periods.flatMap((p) => [Number(p.totalIncome) || 0, Number(p.totalExpenses) || 0]));
  const barH = (v: number) => Math.max(v > 0 ? 3 : 0, (v / max) * CHART_H * t);
  return (
    <Card>
      <View style={styles.trendHead}>
        <Text style={type.heading}>Income vs spending</Text>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Legend color={colors.primary} label="Income" />
          <Legend color={colors.warning} label="Spent" />
        </View>
      </View>
      {periods.length < 2 ? (
        <Text style={[type.small, { marginTop: space.md }]}>Add a second month to see how your income and spending move over time.</Text>
      ) : (
        <View style={styles.chart}>
          {periods.map((p) => {
            const on = (p.groupId ?? p.yearId) === currentId;
            return (
              <View key={`${p.yearId}-${p.groupId ?? 'y'}`} style={[styles.col, on && styles.colOn]} accessibilityLabel={`${p.label}: income ${inr(p.totalIncome)}, spent ${inr(p.totalExpenses)}`}>
                <View style={styles.bars}>
                  <View style={[styles.bar, { height: barH(Number(p.totalIncome) || 0), backgroundColor: colors.primary }]} />
                  <View style={[styles.bar, { height: barH(Number(p.totalExpenses) || 0), backgroundColor: colors.warning }]} />
                </View>
                <Text style={[styles.colLabel, on && { color: colors.primary, fontWeight: '800' }]}>{shortLabel(p.label)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={type.small}>{label}</Text></View>
);

// ── spending by category ─────────────────────────────────────────────────────
const SLICE_COLORS = ['#0F766E', '#2563EB', '#D97706', '#DB2777', '#7C3AED', '#94A3B8'];
const titleCase = (s: string) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function CategoryCard({ slices }: { slices: CategorySlice[] }) {
  const t = useReveal(900, 300);
  return (
    <Card>
      <Text style={type.heading}>Where it went</Text>
      <View style={styles.stack}>
        {slices.map((s, i) => <View key={s.name} style={{ flex: Math.max(0.0001, s.share * t), backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />)}
      </View>
      <View style={{ gap: space.md }}>
        {slices.map((s, i) => (
          <View key={s.name} style={styles.sliceRow}>
            <View style={[styles.dot, { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }]} />
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{titleCase(s.name)}</Text>
            <Text style={type.small}>{Math.round(s.share * 100)}%</Text>
            <Text style={[type.amount, { minWidth: 76, textAlign: 'right' }]}>{inrCompact(s.total)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── needs attention ──────────────────────────────────────────────────────────
const ATTENTION_STYLE: Record<Attention['tone'], { icon: IconName; fg: string; bg: string }> = {
  negative: { icon: 'alert-triangle', fg: colors.negative, bg: colors.negativeSoft },
  warning: { icon: 'shield', fg: colors.warning, bg: colors.warningSoft },
  info: { icon: 'clock', fg: colors.info, bg: colors.infoSoft },
};

export function AttentionCard({ items, onOpen }: { items: Attention[]; onOpen: (item: Attention) => void }) {
  if (items.length === 0) {
    return (
      <Card style={styles.allClear}>
        <View style={[styles.attIcon, { backgroundColor: colors.positiveSoft }]}><Feather name="check" size={18} color={colors.positive} /></View>
        <View style={{ flex: 1 }}>
          <Text style={type.body}>You're all caught up</Text>
          <Text style={type.small}>No unpaid bills or premiums due soon.</Text>
        </View>
      </Card>
    );
  }
  return (
    <Card style={{ padding: 0 }}>
      {items.map((item, i) => {
        const s = ATTENTION_STYLE[item.tone];
        return (
          <Pressable key={item.id} onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.detail}`} style={[styles.attRow, i > 0 && styles.attDivider]}>
            <View style={[styles.attIcon, { backgroundColor: s.bg }]}><Feather name={s.icon} size={18} color={s.fg} /></View>
            <View style={{ flex: 1 }}>
              <Text style={type.body} numberOfLines={1}>{item.title}</Text>
              <Text style={[type.small, item.tone === 'negative' && { color: colors.negative }]}>{item.detail}</Text>
            </View>
            {item.amount ? <Text style={type.amount}>{inr(item.amount)}</Text> : null}
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        );
      })}
    </Card>
  );
}

// ── snapshot tiles ───────────────────────────────────────────────────────────
export type Tile = { key: string; icon: IconName; tone: Tone; label: string; value: string; note?: string; noteTone?: Tone; onPress: () => void };

const TILE_COLOR: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textDim, bg: colors.surfaceAlt }, positive: { fg: colors.positive, bg: colors.positiveSoft }, negative: { fg: colors.negative, bg: colors.negativeSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft }, info: { fg: colors.info, bg: colors.infoSoft }, primary: { fg: colors.primary, bg: colors.primarySoft },
};

export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <Pressable key={t.key} onPress={t.onPress} accessibilityRole="button" accessibilityLabel={`${t.label} ${t.value}`} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
          <View style={[styles.tileIcon, { backgroundColor: TILE_COLOR[t.tone].bg }]}><Feather name={t.icon} size={16} color={TILE_COLOR[t.tone].fg} /></View>
          <Text style={type.caption}>{t.label}</Text>
          <Text style={[type.amount, { fontSize: 18, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
          {!!t.note && <Text style={[type.small, { marginTop: 2, color: TILE_COLOR[t.noteTone ?? 'neutral'].fg }]} numberOfLines={1}>{t.note}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

// ── quick actions ────────────────────────────────────────────────────────────
export function QuickActions({ actions }: { actions: Array<{ key: string; icon: IconName; label: string; onPress: () => void }> }) {
  return (
    <View style={styles.quick}>
      {actions.map((a) => (
        <Pressable key={a.key} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}>
          <View style={styles.quickIcon}><Feather name={a.icon} size={20} color={colors.primary} /></View>
          <Text style={styles.quickLabel}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── loading skeleton ─────────────────────────────────────────────────────────
export function HomeSkeleton() {
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Loading your dashboard">
      <Pulse style={{ height: 190, borderRadius: radius.xl, backgroundColor: colors.border }} />
      <Pulse style={{ height: 210, borderRadius: radius.lg, backgroundColor: colors.border }} />
      <Pulse style={{ height: 170, borderRadius: radius.lg, backgroundColor: colors.border }} />
      <Pulse style={{ height: 110, borderRadius: radius.lg, backgroundColor: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  heroBlobA: { position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlobB: { position: 'absolute', right: 50, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  heroValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '800', marginTop: 6, marginBottom: space.lg, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  heroBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)', gap: 2, marginBottom: space.lg },
  heroRow: { flexDirection: 'row', gap: space.md },
  heroStatLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatCaption: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  heroStatValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg },
  monthBody: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  ringPct: { fontSize: 28, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  monthLeft: { fontSize: 26, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  monthPair: { flexDirection: 'row', gap: space.xl },
  unpaid: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg, backgroundColor: colors.warningSoft, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
  unpaidText: { color: '#92400E', fontSize: 13, fontWeight: '600', flex: 1 },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: space.lg },
  col: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.md },
  colOn: { backgroundColor: colors.primarySoft },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_H },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  colLabel: { marginTop: 6, fontSize: 11, color: colors.muted, fontWeight: '600' },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginVertical: space.lg },
  sliceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  attDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  attIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, ...shadow },
  tileIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.textDim },
});
