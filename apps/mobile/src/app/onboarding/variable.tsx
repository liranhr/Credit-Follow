import { computeBudgetPlan, parseMoneyToMinor } from '@credit-follow/shared';
import { router } from 'expo-router';
import { useState } from 'react';
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
 * Onboarding step 3: variable spending budgets (custom categories, at least one).
 * "הבא" validates the current row and appends another optional row; "לשלב הבא" continues.
 */
export default function OnboardingVariableScreen() {
  const { income, fixedRows, variableRows, setVariableRows } = useOnboarding();
  const editor = useExpenseRows(variableRows, setVariableRows, rowNames(fixedRows));
  const [formError, setFormError] = useState<string>();

  const incomeMinor = parseMoneyToMinor(income) ?? 0;
  const fixedMinor = sumRows(fixedRows);
  const variableMinor = sumRows(variableRows);
  const plan = computeBudgetPlan({ incomeMinor, fixedMinor, savingsMinor: 0, variableMinor });

  function nextStep() {
    const { valid, filledCount } = editor.validateAll();
    if (filledCount === 0) {
      setFormError(he.onboarding.variable.atLeastOne);
      return;
    }
    setFormError(undefined);
    if (valid) router.push('/onboarding/savings');
  }

  return (
    <Screen
      back
      footer={
        <View style={styles.buttons}>
          <Button
            label={he.onboarding.next}
            icon="add"
            variant="secondary"
            onPress={() => {
              setFormError(undefined);
              editor.addRow();
            }}
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
      <StepIndicator step={3} />
      <AppText variant="display" block>
        {he.onboarding.variable.title}
      </AppText>
      <AppText variant="body" color={colors.textMuted} block>
        {he.onboarding.variable.subtitle}
      </AppText>

      <PlanSummary
        lines={[
          { label: he.onboarding.plan.afterFixed, amountMinor: plan.incomeAfterFixedMinor },
          { label: he.onboarding.variable.total, amountMinor: variableMinor, sign: '−' },
          {
            label: he.onboarding.plan.unallocated,
            amountMinor: plan.unallocatedMinor,
            sign: '=',
            emphasis: true,
          },
        ]}
        footer={
          plan.fixedExceedsIncome ? (
            <Banner tone="warning" message={he.onboarding.plan.fixedExceedsIncome} />
          ) : undefined
        }
      />
      {formError && <Banner message={formError} />}

      <ExpenseRowsEditor
        rows={variableRows}
        errors={editor.errors}
        onChange={(key, patch) => {
          setFormError(undefined);
          editor.change(key, patch);
        }}
        onRemove={editor.remove}
        onSubmitLast={editor.addRow}
        nameRefs={editor.nameRefs}
        labels={{
          rowTitle: he.onboarding.variable.rowTitle,
          optionalRow: he.onboarding.variable.optionalRow,
          namePlaceholder: he.onboarding.variable.namePlaceholder,
        }}
      />
      <View style={{ height: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
