import { Feather } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator, KeyboardTypeOptions, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, space, type } from './theme';
import { useKeyboardHeight } from './hooks';

export type IconName = keyof typeof Feather.glyphMap;
export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'primary';

const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textDim, bg: colors.surfaceAlt },
  positive: { fg: colors.positive, bg: colors.positiveSoft },
  negative: { fg: colors.negative, bg: colors.negativeSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  primary: { fg: colors.primary, bg: colors.primarySoft },
};
export const toneColor = (tone: Tone) => toneColors[tone].fg;

// ── Layout ───────────────────────────────────────────────────────────────────
type ScreenProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  fab?: ReactNode; // floating action, rendered above the scroll area
  children: ReactNode;
};

// Page shell: header + scrollable body with pull-to-refresh. Bottom padding clears the tab bar.
export function Screen({ title, subtitle, onBack, right, refreshing, onRefresh, fab, children }: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Go back">
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={type.small} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
      >
        {children}
      </ScrollView>
      {fab}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const content = [styles.card, style];
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [...content, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
  return <View style={content}>{children}</View>;
}

export const SectionTitle = ({ children, action }: { children: string; action?: ReactNode }) => (
  <View style={styles.sectionTitle}>
    <Text style={type.caption}>{children}</Text>
    {action}
  </View>
);

// ── Controls ─────────────────────────────────────────────────────────────────
type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, small, style }: ButtonProps) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    danger: { bg: colors.negativeSoft, fg: colors.negative, border: colors.negativeSoft },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button, small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : icon ? <Feather name={icon} size={small ? 14 : 16} color={palette.fg} /> : null}
      <Text style={[styles.buttonLabel, small && { fontSize: 13 }, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tone = 'neutral' }: { icon: IconName; onPress: () => void; label: string; tone?: Tone }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, { backgroundColor: toneColors[tone].bg, opacity: pressed ? 0.7 : 1 }]}>
      <Feather name={icon} size={16} color={toneColors[tone].fg} />
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  hint?: string;
};

export function Field({ label, value, onChangeText, placeholder, keyboardType, secure, autoCapitalize, multiline, hint }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize ?? (secure || keyboardType === 'email-address' ? 'none' : 'sentences')}
          autoCorrect={false}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {!!hint && <Text style={[type.small, { marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}

type ChipOption<T extends string> = { value: T; label: string };
export function Chips<T extends string>({ options, value, onChange, label }: { options: ChipOption<T>[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <View style={{ marginBottom: label ? space.md : space.sm }}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipLabel, on && { color: colors.onPrimary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Dropdown: shows the current choice; tapping opens a list in a bottom sheet. Better than chips for long or growing lists.
export function Select<T extends string>({ label, value, options, onChange, placeholder = 'Select' }: {
  label: string; value: T; options: ChipOption<T>[]; onChange: (v: T) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        accessibilityHint="Opens a list of choices"
        style={({ pressed }) => [styles.select, pressed && { opacity: 0.85 }]}
      >
        <Text style={[styles.selectText, !selected && { color: colors.muted }]} numberOfLines={1}>{selected?.label ?? placeholder}</Text>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => { onChange(o.value); setOpen(false); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <Text style={[styles.optionLabel, on && { color: colors.primary, fontWeight: '700' }]}>{o.label}</Text>
              {on && <Feather name="check" size={18} color={colors.primary} />}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

// ── Display ──────────────────────────────────────────────────────────────────
export const Badge = ({ label, tone = 'neutral' }: { label: string; tone?: Tone }) => (
  <View style={[styles.badge, { backgroundColor: toneColors[tone].bg }]}>
    <Text style={[styles.badgeLabel, { color: toneColors[tone].fg }]}>{label}</Text>
  </View>
);

export function Stat({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: Tone; icon?: IconName }) {
  return (
    <View style={styles.stat}>
      {icon && (
        <View style={[styles.statIcon, { backgroundColor: toneColors[tone].bg }]}>
          <Feather name={icon} size={16} color={toneColors[tone].fg} />
        </View>
      )}
      <Text style={type.caption}>{label}</Text>
      <Text style={[type.amount, { fontSize: 18, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

export const ProgressBar = ({ value, tone = 'primary' }: { value: number; tone?: Tone }) => (
  <View style={styles.track}>
    <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: toneColors[tone].fg }]} />
  </View>
);

export const Loading = () => (
  <View style={{ paddingVertical: space.xxl * 2, alignItems: 'center' }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Feather name={icon} size={24} color={colors.primary} /></View>
      <Text style={type.heading}>{title}</Text>
      {!!hint && <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Feather name="alert-circle" size={16} color={colors.negative} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Pressable onPress={onRetry} hitSlop={8}><Text style={[styles.errorText, { fontWeight: '700' }]}>Retry</Text></Pressable>}
    </View>
  );
}

// ── Overlays ─────────────────────────────────────────────────────────────────
type SheetProps = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const keyboard = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: keyboard }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} testID="sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={type.heading}>{title}</Text>
            <IconButton icon="x" onPress={onClose} label="Close" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.xl }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmSheet({ visible, title, message, confirmLabel = 'Remove', onConfirm, onClose, details }: {
  visible: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; details?: ReactNode;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {!!message && <Text style={[type.body, { marginBottom: space.lg }]}>{message}</Text>}
      {details}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button label={confirmLabel} variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
      <Feather name="plus" size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  back: { marginLeft: -6, padding: 4 },
  body: { padding: space.lg, paddingBottom: 120, gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, ...shadow },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.xl, borderRadius: radius.md, borderWidth: 1 },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
  iconButton: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...type.small, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: space.md },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text, paddingVertical: 10, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  chip: { paddingHorizontal: space.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: space.md },
  selectText: { flex: 1, fontSize: 16, color: colors.text },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md },
  optionOn: { backgroundColor: colors.primarySoft },
  optionLabel: { fontSize: 16, color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeLabel: { fontSize: 11, fontWeight: '700' },
  stat: { flex: 1, minWidth: 140, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, ...shadow },
  statIcon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: space.xxl * 1.5, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.negativeSoft, borderRadius: radius.md, padding: space.md },
  errorText: { flex: 1, color: colors.negative, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  fab: { position: 'absolute', right: space.lg, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.25 },
});
