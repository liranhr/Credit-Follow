import { parseMoneyToMinor } from '@credit-follow/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { he } from '@/i18n/he';
import { colors, radii, spacing } from '@/theme';
import { formatMinorUnits } from '@/utils/money';
import { AppText } from './AppText';
import { Button } from './Button';
import { MoneyField } from './MoneyField';

/** Labels of the six full months before the current one, most recent first. */
function previousSixMonths(now = new Date()): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    return `${he.months[d.getMonth()]} ${d.getFullYear()}`;
  });
}

/**
 * Helps the user compute the average monthly income over the previous six months.
 * Empty months are ignored; the result is rounded to whole agorot.
 */
export function IncomeCalculator({ onUse }: { onUse: (averageMinor: number) => void }) {
  const [months] = useState(previousSixMonths);
  const [values, setValues] = useState<string[]>(() => months.map(() => ''));

  const parsed = values.map((v) => (v.trim() ? parseMoneyToMinor(v) : null));
  const valid = parsed.filter((v): v is number => v !== null && v > 0);
  const average =
    valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;

  return (
    <View style={styles.box}>
      <AppText variant="caption" color={colors.textMuted} block>
        {he.onboarding.income.calculatorHint}
      </AppText>
      <View style={styles.grid}>
        {months.map((label, index) => (
          <View key={label} style={styles.cell}>
            <MoneyField
              label={label}
              value={values[index]}
              error={
                values[index]?.trim() && parsed[index] === null
                  ? he.errors.amountInvalid
                  : undefined
              }
              onChangeText={(text) =>
                setValues((prev) => prev.map((v, i) => (i === index ? text : v)))
              }
            />
          </View>
        ))}
      </View>
      {average !== null && (
        <View style={styles.result}>
          <AppText variant="subtitle" block style={styles.flex}>
            {he.onboarding.income.calculatorResult(formatMinorUnits(average), valid.length)}
          </AppText>
          <Button label={he.onboarding.income.useAverage} compact onPress={() => onUse(average)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexBasis: '47%', flexGrow: 1 },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
