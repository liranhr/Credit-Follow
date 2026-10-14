import { minorToInputString, parseMoneyToMinor } from '@credit-follow/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useCurrentUser } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Banner } from '@/components/Feedback';
import { IncomeCalculator } from '@/components/IncomeCalculator';
import { MoneyField } from '@/components/MoneyField';
import { Screen } from '@/components/Screen';
import { useUpdateFinance } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors } from '@/theme';
import { describeError, fieldErrors } from '@/utils/format';

/** "עריכת הכנסות": update the average monthly income (and the savings goal). */
export default function IncomeScreen() {
  const user = useCurrentUser();
  const update = useUpdateFinance();
  const [income, setIncome] = useState(minorToInputString(user.finance.averageMonthlyIncomeMinor));
  const [savings, setSavings] = useState(minorToInputString(user.finance.monthlySavingsGoalMinor));
  const [errors, setErrors] = useState<{ income?: string; savings?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [showCalculator, setShowCalculator] = useState(false);

  async function submit() {
    const incomeMinor = parseMoneyToMinor(income);
    const savingsMinor = parseMoneyToMinor(savings);
    const nextErrors = {
      ...(incomeMinor === null && { income: he.errors.amountInvalid }),
      ...(incomeMinor === 0 && { income: he.errors.amountRequired }),
      ...(savingsMinor === null && { savings: he.errors.amountInvalid }),
      ...(incomeMinor &&
        savingsMinor !== null &&
        savingsMinor > incomeMinor && { savings: he.errors.savingsAboveIncome }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !incomeMinor || savingsMinor === null) return;

    setFormError(undefined);
    try {
      await update.mutateAsync({
        averageMonthlyIncomeMinor: incomeMinor,
        monthlySavingsGoalMinor: savingsMinor,
      });
      router.back();
    } catch (e) {
      const fields = fieldErrors(e);
      if (fields.averageMonthlyIncomeMinor || fields.monthlySavingsGoalMinor) {
        setErrors({
          income: fields.averageMonthlyIncomeMinor,
          savings: fields.monthlySavingsGoalMinor,
        });
      } else {
        setFormError(describeError(e));
      }
    }
  }

  return (
    <Screen
      title={he.incomeScreen.title}
      back
      footer={<Button label={he.common.save} onPress={submit} loading={update.isPending} />}
    >
      <AppText variant="body" color={colors.textMuted} block>
        {he.incomeScreen.subtitle}
      </AppText>
      {formError && <Banner message={formError} />}
      <Card>
        <MoneyField
          label={he.incomeScreen.income}
          hint={he.onboarding.income.subtitle}
          value={income}
          onChangeText={(text) => {
            setIncome(text);
            setErrors((e) => ({ ...e, income: undefined }));
          }}
          error={errors.income}
        />
        <Button
          label={
            showCalculator
              ? he.onboarding.income.calculatorHide
              : he.onboarding.income.calculatorToggle
          }
          icon="calculator-outline"
          variant="ghost"
          compact
          onPress={() => setShowCalculator((v) => !v)}
        />
        {showCalculator && (
          <IncomeCalculator
            onUse={(average) => {
              setIncome(minorToInputString(average));
              setShowCalculator(false);
            }}
          />
        )}
      </Card>
      <Card>
        <MoneyField
          label={he.incomeScreen.savings}
          value={savings}
          onChangeText={(text) => {
            setSavings(text);
            setErrors((e) => ({ ...e, savings: undefined }));
          }}
          error={errors.savings}
        />
      </Card>
    </Screen>
  );
}
