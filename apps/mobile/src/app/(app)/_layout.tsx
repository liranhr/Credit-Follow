import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="transactions/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="categories/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
