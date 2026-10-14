import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/onboarding/OnboardingContext';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
    </OnboardingProvider>
  );
}
