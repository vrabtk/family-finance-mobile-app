import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PINNABLE, PIN_SLOTS, PinKey, movePin, pinInfo, togglePin } from '../navigation';
import { colors, space, type } from '../theme';
import { Badge, Card, IconButton, Screen, SectionTitle } from '../ui';

// Home and More are always on the bar. The user picks and orders the other three; everything else lives under More.
export function TabsScreen({ pins, onChange, onBack }: { pins: PinKey[]; onChange: (pins: PinKey[]) => void; onBack: () => void }) {
  const others = PINNABLE.filter((p) => !pins.includes(p.key));
  const full = pins.length >= PIN_SLOTS;
  return (
    <Screen title="Bottom bar" subtitle="Home and More are always there" onBack={onBack}>
      <SectionTitle>{`On the bar (${pins.length} of ${PIN_SLOTS})`}</SectionTitle>
      <Card style={{ padding: 0 }}>
        {pins.length === 0 && <Text style={[type.small, { padding: space.lg }]}>Nothing pinned. Pin up to three screens below.</Text>}
        {pins.map((k, i) => {
          const p = pinInfo(k);
          return (
            <View key={k} style={[styles.row, i > 0 && styles.divider]}>
              <Feather name={p.icon} size={18} color={colors.primary} />
              <Text style={[type.body, { flex: 1 }]}>{p.label}</Text>
              <IconButton icon="arrow-up" label={`Move ${p.label} up`} onPress={() => onChange(movePin(pins, k, -1))} />
              <IconButton icon="arrow-down" label={`Move ${p.label} down`} onPress={() => onChange(movePin(pins, k, 1))} />
              <IconButton icon="x" tone="negative" label={`Unpin ${p.label}`} onPress={() => onChange(togglePin(pins, k))} />
            </View>
          );
        })}
      </Card>

      <SectionTitle>Under More</SectionTitle>
      {full && <Text style={type.small}>The bar is full. Unpin one to pin another.</Text>}
      <Card style={{ padding: 0 }}>
        {others.length === 0 && <Text style={[type.small, { padding: space.lg }]}>Everything is on the bar.</Text>}
        {others.map((p, i) => (
          <Pressable key={p.key} disabled={full} onPress={() => onChange(togglePin(pins, p.key))} accessibilityRole="button" accessibilityLabel={`Pin ${p.label}`} accessibilityState={{ disabled: full }}
            style={[styles.row, i > 0 && styles.divider, full && { opacity: 0.5 }]}>
            <Feather name={p.icon} size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{p.label}</Text>
              <Text style={type.small}>{p.hint}</Text>
            </View>
            <Badge label="Pin" tone="primary" />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
