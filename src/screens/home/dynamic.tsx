// The parts of Home that react to the household's data: highlights, the getting-started checklist,
// and the sheet that lets people choose which sections they see.
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HOME_SECTIONS, HomeLayout, SectionId } from '../../home/layout';
import { Insight, InsightTarget } from '../../home/insights';
import { SetupStep, setupProgress } from '../../home/setup';
import { colors, space, type } from '../../theme';
import { Button, Card, IconButton, ProgressBar, Sheet, toneColor } from '../../ui';

export function InsightsCard({ insights, onAction }: { insights: Insight[]; onAction: (to: InsightTarget) => void }) {
  return (
    <Card style={{ padding: 0 }}>
      {insights.map((it, i) => {
        const tint = toneColor(it.tone);
        return (
          <View key={it.id} style={[styles.insight, i > 0 && styles.divider]} accessibilityRole="summary" accessibilityLabel={`${it.title}. ${it.detail}`}>
            <View style={[styles.insightIcon, { backgroundColor: `${tint}1F` }]}><Feather name={it.icon} size={18} color={tint} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.body}>{it.title}</Text>
              <Text style={type.small}>{it.detail}</Text>
              {it.action && (
                <Pressable onPress={() => onAction(it.action!.to)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  <Text style={[type.small, { color: colors.primary, fontWeight: '700' }]}>{it.action.label}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function SetupCard({ steps, onOpen, onTour }: { steps: SetupStep[]; onOpen: (step: SetupStep) => void; onTour?: () => void }) {
  const { done, total } = setupProgress(steps);
  return (
    <Card>
      <View style={styles.setupHead}>
        <Text style={type.heading}>Getting started</Text>
        <Text style={type.small}>{done} of {total}</Text>
      </View>
      <View style={{ marginVertical: space.sm }}><ProgressBar value={done / total} tone="primary" /></View>
      {steps.map((s) => (
        <Pressable key={s.id} onPress={() => onOpen(s)} disabled={s.done} accessibilityRole="button" accessibilityState={{ checked: s.done, disabled: s.done }}
          accessibilityLabel={`${s.label}${s.done ? ', done' : ''}`} style={styles.setupRow}>
          <View style={[styles.tick, s.done && styles.tickOn]}>{s.done && <Feather name="check" size={13} color={colors.onPrimary} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, s.done && styles.struck]}>{s.label}</Text>
            {!s.done && <Text style={type.small}>{s.hint}</Text>}
          </View>
          {!s.done && <Feather name="chevron-right" size={18} color={colors.muted} />}
        </Pressable>
      ))}
      {onTour && <Button label="Take the app tour" icon="map" variant="secondary" small onPress={onTour} style={{ marginTop: space.md }} />}
    </Card>
  );
}

// Show, hide and reorder the dashboard sections.
export function CustomizeHomeSheet({ layout, onToggle, onMove, onReset, onClose }: {
  layout: HomeLayout; onToggle: (id: SectionId) => void; onMove: (id: SectionId, delta: -1 | 1) => void; onReset: () => void; onClose: () => void;
}) {
  const info = (id: SectionId) => HOME_SECTIONS.find((s) => s.id === id)!;
  return (
    <Sheet visible title="Customize dashboard" onClose={onClose}>
      <Text style={[type.small, { marginBottom: space.md }]}>Choose what to show and the order. Hidden sections can come back any time.</Text>
      {layout.order.map((id, i) => {
        const shown = !layout.hidden.includes(id);
        return (
          <View key={id} style={styles.sheetRow}>
            <IconButton icon={shown ? 'eye' : 'eye-off'} tone={shown ? 'primary' : 'neutral'} label={`${shown ? 'Hide' : 'Show'} ${info(id).label}`} onPress={() => onToggle(id)} />
            <View style={{ flex: 1, opacity: shown ? 1 : 0.5 }}>
              <Text style={type.body}>{info(id).label}</Text>
              <Text style={type.small} numberOfLines={1}>{info(id).hint}</Text>
            </View>
            <IconButton icon="arrow-up" label={`Move ${info(id).label} up`} onPress={() => i > 0 && onMove(id, -1)} />
            <IconButton icon="arrow-down" label={`Move ${info(id).label} down`} onPress={() => i < layout.order.length - 1 && onMove(id, 1)} />
          </View>
        );
      })}
      <Button label="Reset to default" variant="secondary" onPress={onReset} style={{ marginTop: space.md }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  insight: { flexDirection: 'row', gap: space.md, padding: space.lg },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  setupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setupRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: colors.positive, borderColor: colors.positive },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
