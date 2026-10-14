import { computeBudgetPlan, minorToInputString, parseMoneyToMinor } from '@credit-follow/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Banner } from '@/components/Feedback';
import { MoneyField } from '@/components/MoneyField';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { he } from '@/i18n/he';
import { rowsToPayload, sumRows } from '@/onboarding/expenseRows';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { PlanSummary } from '@/onboarding/PlanSummary';
import { StepIndicator } from '@/onboarding/StepIndicator';
import { colors, spacing } from '@/theme';
import { describeError, fieldErrors } from '@/utils/format';
import { formatMinorUnits } from '@/utils/money';

/**
 * Onboarding step 4: monthly savings goal. Shows the full plan and warns (without changing
 * anything) when fixed expenses exceed income or variable budgets exceed what is available.
 * "לסיום" submits the whole onboarding.
 */
export default function OnboardingSavingsScreen() {
  const { income, fixedRows, variableRows, savings, setSavings } = useOnboarding();
  const { setUser } = useAuth();
  const [error, setError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const incomeMinor = parseMoneyToMinor(income) ?? 0;
  const fixedMinor = sumRows(fixedRows);
  const variableMinor = sumRows(variableRows);
  const savingsMinor = parseMoneyToMinor(savings);
  const plan = computeBudgetPlan({
    incomeMinor,
    fixedMinor,
    savingsMinor: savingsMinor ?? 0,
    variableMinor,
  });
  // What could be saved if nothing else is allocated: income − fixed − variable budgets.
  const maxSavingsMinor = plan.incomeAfterFixedMinor - variableMinor;

  const suggestions = [10, 20]
    .map((pct) => ({
      value: Math.round((incomeMinor * pct) / 100),
      label: he.onboarding.savings.suggestion(pct),
    }))
    .concat(
      maxSavingsMinor > 0
        ? [{ value: maxSavingsMinor, label: he.onboarding.savings.allUnallocated }]
        : [],
    )
    .filter((s) => s.value > 0);

  async function finish() {
    if (savingsMinor === null) return setError(he.errors.amountInvalid);
    if (savingsMinor > incomeMinor) return setError(he.errors.savingsAboveIncome);
    setError(undefined);
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      const user = await api.onboarding.complete({
        averageMonthlyIncomeMinor: incomeMinor,
        fixedExpenses: rowsToPayload(fixedRows),
        variableExpenses: rowsToPayload(variableRows),
        monthlySavingsGoalMinor: savingsMinor,
      });
      // Completing onboarding flips the route guard and opens the dashboard.
      setUser(user);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ONBOARDING_COMPLETED') {
        setUser(await api.me.get());
        return;
      }
      const fields = fieldErrors(e);
      if (fields.monthlySavingsGoalMinor) setError(fields.monthlySavingsGoalMinor);
      else setSubmitError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      back
      footer={
        <Button
          label={he.onboarding.finish}
          icon="checkmark"
          onPress={finish}
          loading={submitting}
        />
      }
    >
      <StepIndicator step={4} />
      <AppText variant="display" block>
        {he.onboarding.savings.title}
      </AppText>
      <AppText variant="body" color={colors.textMuted} block>
        {he.onboarding.savings.subtitle}
      </AppText>
      {submitError && <Banner message={submitError} />}

      <Card>
        <MoneyField
          label={he.onboarding.savings.label}
          value={savings}
          onChangeText={(text) => {
            setSavings(text);
            setError(undefined);
          }}
          error={error}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={finish}
        />
        {suggestions.length > 0 && (
          <SegmentedControl
            wrap
            value={savingsMinor !== null ? String(savingsMinor) : undefined}
            onChange={(value) => setSavings(minorToInputString(Number(value)))}
            options={suggestions.map((s) => ({
              value: String(s.value),
              label: `${s.label} · ${formatMinorUnits(s.value)}`,
            }))}
          />
        )}
      </Card>

      <PlanSummary
        lines={[
          { label: he.onboarding.plan.income, amountMinor: incomeMinor },
          { label: he.onboarding.plan.fixed, amountMinor: fixedMinor, sign: '−' },
          {
            label: he.onboarding.plan.afterFixed,
            amountMinor: plan.incomeAfterFixedMinor,
            sign: '=',
          },
          { label: he.onboarding.plan.savings, amountMinor: savingsMinor ?? 0, sign: '−' },
          {
            label: he.onboarding.plan.availableForVariable,
            amountMinor: plan.availableForVariableMinor,
            sign: '=',
          },
          { label: he.onboarding.plan.variable, amountMinor: variableMinor, sign: '−' },
          {
            label: he.onboarding.plan.unallocated,
            amountMinor: plan.unallocatedMinor,
            sign: '=',
            emphasis: true,
          },
        ]}
        footer={
          <>
            {plan.fixedExceedsIncome && (
              <Banner tone="warning" message={he.onboarding.plan.fixedExceedsIncome} />
            )}
            {!plan.fixedExceedsIncome && plan.variableOverAllocatedMinor > 0 && (
              <Banner
                tone="warning"
                message={he.onboarding.plan.variableExceedsAvailable(
                  formatMinorUnits(plan.availableForVariableMinor),
                )}
              />
            )}
          </>
        }
      />
      <View style={{ height: spacing.sm }} />
    </Screen>
  );
}
