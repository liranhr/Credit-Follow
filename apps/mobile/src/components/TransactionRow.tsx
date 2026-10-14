import type { ExpenseTransactionDto } from '@credit-follow/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { he } from '@/i18n/he';
import { colors, spacing } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { formatMinorUnits } from '@/utils/money';
import { AppText } from './AppText';
import { StatusBadge } from './StatusBadge';

export function TransactionRow({
  transaction,
  categoryName,
  onPress,
}: {
  transaction: ExpenseTransactionDto;
  categoryName: string;
  onPress: () => void;
}) {
  const subtitle = [
    formatShortDate(transaction.occurredOn),
    he.paymentMethods[transaction.paymentMethod],
    transaction.chargeOn &&
      (transaction.status === 'pending'
        ? he.transactions.chargeOn(formatShortDate(transaction.chargeOn))
        : he.transactions.chargedOn(formatShortDate(transaction.chargeOn))),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${categoryName} ${formatMinorUnits(transaction.amountMinor)} ${he.statuses[transaction.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <AppText variant="subtitle" block numberOfLines={1}>
          {transaction.description || categoryName}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} block numberOfLines={1}>
          {transaction.description ? `${categoryName} · ${subtitle}` : subtitle}
        </AppText>
      </View>
      <View style={styles.side}>
        <AppText variant="subtitle">{formatMinorUnits(transaction.amountMinor)}</AppText>
        <StatusBadge status={transaction.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  main: { flex: 1, alignItems: 'flex-start', gap: 2 },
  side: { alignItems: 'flex-end', gap: spacing.xs },
});
