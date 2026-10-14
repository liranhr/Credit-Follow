import type { TransactionStatus } from '@credit-follow/shared';
import { StyleSheet, View } from 'react-native';
import { he } from '@/i18n/he';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

const badgeColors: Record<TransactionStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.warningSoft, fg: colors.warningText },
  charged: { bg: colors.infoSoft, fg: colors.infoText },
  paid: { bg: colors.accentSoft, fg: colors.accentText },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const c = badgeColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <AppText variant="caption" color={c.fg} style={styles.text}>
        {he.statuses[status]}
      </AppText>
    </View>
  );
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11 },
});
