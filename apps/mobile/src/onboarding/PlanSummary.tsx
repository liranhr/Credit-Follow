import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { colors, spacing } from '@/theme';
import { formatMinorUnits } from '@/utils/money';

export interface PlanLine {
  label: string;
  amountMinor: number;
  /** Prefix shown before the amount, e.g. "−" for deductions. */
  sign?: '−' | '=';
  emphasis?: boolean;
}

/** A small "calculation" card: income − fixed = …, rendered right-to-left. */
export function PlanSummary({ lines, footer }: { lines: PlanLine[]; footer?: React.ReactNode }) {
  return (
    <Card>
      {lines.map((line) => (
        <View
          key={line.label}
          style={[styles.row, line.emphasis && styles.emphasisRow]}
          accessibilityLabel={`${line.label}: ${formatMinorUnits(line.amountMinor)}`}
        >
          <AppText
            variant={line.emphasis ? 'subtitle' : 'body'}
            color={line.emphasis ? colors.text : colors.textMuted}
            style={styles.label}
          >
            {line.sign ? `${line.sign} ` : ''}
            {line.label}
          </AppText>
          <AppText
            variant={line.emphasis ? 'title' : 'subtitle'}
            color={line.amountMinor < 0 ? colors.dangerText : colors.text}
          >
            {formatMinorUnits(line.amountMinor)}
          </AppText>
        </View>
      ))}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  emphasisRow: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  label: { flex: 1 },
});
