export const colors = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  primary: '#0F2A4A',
  primaryMuted: '#1E3F66',
  accent: '#22C55E',
  accentSoft: '#DCFCE7',
  accentText: '#15803D',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningText: '#B45309',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  dangerText: '#B91C1C',
  info: '#3B82F6',
  infoSoft: '#DBEAFE',
  infoText: '#1D4ED8',
  text: '#0F172A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryMuted: 'rgba(255,255,255,0.72)',
  border: '#E2E8F0',
  overlay: 'rgba(15,23,42,0.45)',
  google: '#FFFFFF',
  facebook: '#1877F2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '500' },
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Color per category budget status. */
export const budgetStatusColors = {
  ok: colors.accent,
  warning: colors.warning,
  over: colors.danger,
  unbudgeted: colors.info,
} as const;
