import { Platform, TextStyle, ViewStyle } from 'react-native';

// Light, clean fintech theme: neutral page, white cards, deep-teal accent.
export const colors = {
  bg: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E5E9F0',
  borderStrong: '#CBD5E1',

  text: '#0F172A',
  textDim: '#475569',
  muted: '#94A3B8',

  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#E6F4F1',
  onPrimary: '#FFFFFF',

  positive: '#16A34A',
  positiveSoft: '#DCFCE7',
  negative: '#DC2626',
  negativeSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  info: '#2563EB',
  infoSoft: '#DBEAFE',

  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 } as TextStyle,
  heading: { fontSize: 18, fontWeight: '700', color: colors.text } as TextStyle,
  body: { fontSize: 15, color: colors.text } as TextStyle,
  small: { fontSize: 13, color: colors.textDim } as TextStyle,
  caption: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' } as TextStyle,
  amount: { fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] } as TextStyle,
};

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)' } as ViewStyle,
}) as ViewStyle;
