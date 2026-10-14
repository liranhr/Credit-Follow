import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ErrorView } from '@/components/Feedback';
import { he } from '@/i18n/he';
import { ensureRTL } from '@/i18n/rtl';
import { colors } from '@/theme';

ensureRTL();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Don't retry client errors (validation, not found, auth).
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

/**
 * Route guards: signed-out users only see /sign-in, signed-in users who have not finished
 * onboarding only see /onboarding, everyone else sees the app. Guards are client-side UX —
 * the API independently authorizes every request.
 */
function RootNavigator() {
  const { status, user, retry } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') return null;
  if (status === 'offline') return <ErrorView message={he.errors.network} onRetry={retry} />;

  const signedIn = status === 'signedIn' && user !== null;
  const onboarded = Boolean(user?.onboardingCompleted);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
