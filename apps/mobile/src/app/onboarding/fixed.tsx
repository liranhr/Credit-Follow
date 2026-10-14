import { computeBudgetPlan, parseMoneyToMinor } from '@credit-follow/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Banner } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { he } from '@/i18n/he';
import { ExpenseRowsEditor } from '@/onboarding/ExpenseRowsEditor';
import { rowNames, sumRows } from '@/onboarding/expenseRows';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { PlanSummary } from '@/onboarding/PlanSummary';
import { StepIndicator } from '@/onboarding/StepIndicator';
import { useExpenseRows } from '@/onboarding/useExpenseRows';
import { colors, spacing } from '@/theme';

/**
 * Onboarding step 2: fixed monthly expenses (custom names and amounts, optional).
 * Shows, live, the income remaining after fixed expenses — the starting point for the
 * variable spending budget.
 */
export default function OnboardingFixedScreen() {
  const { income, fixedRows, setFixedRows, variableRows } = useOnboarding();
  const editor = useExpenseRows(fixedRows, setFixedRows, rowNames(variableRows));

  const incomeMinor = parseMoneyToMinor(income) ?? 0;
  const fixedMinor = sumRows(fixedRows);
  const plan = computeBudgetPlan({ incomeMinor, fixedMinor, savingsMinor: 0, variableMinor: 0 });

  function nextStep() {
    if (editor.validateAll().valid) router.push('/onboarding/variable');
  }

  return (
    <Screen
      back
      footer={
        <View style={styles.buttons}>
          <Button
            label={he.onboarding.fixed.add}
            icon="add"
            variant="secondary"
            onPress={editor.addRow}
            disabled={!editor.canAdd}
            style={styles.flex}
          />
          <Button
            label={he.onboarding.nextStep}
            icon="arrow-back"
            onPress={nextStep}
            style={styles.flex}
          />
        </View>
      }
    >
      <StepIndicator step={2} />
      <AppText variant="display" block>
        {he.onboarding.fixed.title}
      </AppText>
      <AppText variant="body" color={colors.textMuted} block>
        {he.onboarding.fixed.subtitle}
      </AppText>

      <ExpenseRowsEditor
        rows={fixedRows}
        errors={editor.errors}
        onChange={editor.change}
        onRemove={editor.remove}
        onSubmitLast={editor.addRow}
        nameRefs={editor.nameRefs}
        labels={{
          rowTitle: he.onboarding.fixed.rowTitle,
          optionalRow: he.onboarding.fixed.optionalRow,
          namePlaceholder: he.onboarding.fixed.namePlaceholder,
        }}
      />
      {fixedMinor === 0 && <Banner tone="info" message={he.onboarding.fixed.noneHint} />}

      <PlanSummary
        lines={[
          { label: he.onboarding.plan.income, amountMinor: incomeMinor },
          { label: he.onboarding.fixed.total, amountMinor: fixedMinor, sign: '−' },
          {
            label: he.onboarding.plan.afterFixed,
            amountMinor: plan.incomeAfterFixedMinor,
            sign: '=',
            emphasis: true,
          },
        ]}
        footer={
          plan.fixedExceedsIncome ? (
            <Banner tone="warning" message={he.onboarding.plan.fixedExceedsIncome} />
          ) : (
            <AppText variant="caption" color={colors.textMuted} block>
              {he.onboarding.plan.startingPoint}
            </AppText>
          )
        }
      />
      <View style={{ height: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
