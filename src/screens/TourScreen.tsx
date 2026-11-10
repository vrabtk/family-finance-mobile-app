import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../session';
import { colors, space, type } from '../theme';
import { useTour } from '../tour/context';
import { stepsFor } from '../tour/logic';
import { TOURS, tourById } from '../tour/steps';
import { Badge, Button, Card, Screen, SectionTitle } from '../ui';

// The guide menu: the complete tour on top, then one short guide per screen. Guides you have finished get a tick.
export function TourScreen({ onBack }: { onBack: () => void }) {
  const tour = useTour();
  const { role } = useSession();
  const seen = new Set(tour?.seen ?? []);
  const full = tourById('full');
  const each = TOURS.filter((t) => t.id !== 'full');

  return (
    <Screen title="App tour" subtitle="Learn the app at your own pace" onBack={onBack}>
      <Card>
        <View style={styles.heroIcon}><Feather name="map" size={26} color={colors.primary} /></View>
        <Text style={type.heading}>{full.title}</Text>
        <Text style={[type.small, { marginTop: 4, marginBottom: space.lg }]}>
          {full.summary}. About {Math.max(1, Math.round(stepsFor('full', role).length / 4))} minutes, and you can stop any time.
        </Text>
        <Button label={seen.has('full') ? 'Take the tour again' : 'Start the complete tour'} icon="play" onPress={() => tour?.start('full')} disabled={!tour} />
      </Card>

      <SectionTitle>Guide for one screen</SectionTitle>
      <Card style={{ padding: 0 }}>
        {each.map((t, i) => (
          <Pressable key={t.id} onPress={() => tour?.start(t.id)} accessibilityRole="button" accessibilityLabel={`Guide: ${t.title}`} style={[styles.row, i > 0 && styles.divider]}>
            <View style={styles.rowIcon}><Feather name={t.icon} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{t.title}</Text>
              <Text style={type.small}>{t.summary} · {stepsFor(t.id, role).length} {stepsFor(t.id, role).length === 1 ? 'step' : 'steps'}</Text>
            </View>
            {seen.has(t.id) ? <Badge label="Seen" tone="positive" /> : <Feather name="chevron-right" size={20} color={colors.muted} />}
          </Pressable>
        ))}
      </Card>
      <Text style={[type.small, { textAlign: 'center' }]}>Every screen also has a question mark at the top that replays its own guide.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
