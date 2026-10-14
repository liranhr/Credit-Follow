import { minorToInputString, parseMoneyToMinor } from '@credit-follow/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IncomeCalculator } from '@/components/IncomeCalculator';
import { MoneyField } from '@/components/MoneyField';
import { Screen } from '@/components/Screen';
import { he } from '@/i18n/he';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { StepIndicator } from '@/onboarding/StepIndicator';
import { colors } from '@/theme';

/** Onboarding step 1: average monthly income over the previous six months. */
export default function OnboardingIncomeScreen() {
  const { income, setIncome } = useOnboarding();
  const [error, setError] = useState<string>();
  const [showCalculator, setShowCalculator] = useState(false);

  function next() {
    const minor = parseMoneyToMinor(income);
    if (minor === null) return setError(he.errors.amountInvalid);
    if (minor <= 0) return setError(he.errors.amountRequired);
    setError(undefined);
    router.push('/onboarding/fixed');
  }

  return (
    <Screen footer={<Button label={he.onboarding.next} icon="arrow-back" onPress={next} />}>
      <StepIndicator step={1} />
      <AppText variant="display" block>
        {he.onboarding.income.title}
      </AppText>
      <AppText variant="body" color={colors.textMuted} block>
        {he.onboarding.income.subtitle}
      </AppText>

      <Card>
        <MoneyField
          label={he.onboarding.income.label}
          value={income}
          onChangeText={(text) => {
            setIncome(text);
            if (error) setError(undefined);
          }}
          error={error}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={next}
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
              setError(undefined);
              setShowCalculator(false);
            }}
          />
        )}
      </Card>
    </Screen>
  );
}
