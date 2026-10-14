import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { he } from '@/i18n/he';
import { colors, radii, spacing } from '@/theme';

export const ONBOARDING_STEPS = 4;

export function StepIndicator({ step }: { step: number }) {
  return (
    <View style={styles.wrapper} accessibilityLabel={he.onboarding.stepOf(step, ONBOARDING_STEPS)}>
      <View style={styles.bars}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View key={i} style={[styles.bar, i < step && styles.barActive]} />
        ))}
      </View>
      <AppText variant="caption" color={colors.textMuted} block>
        {he.onboarding.stepOf(step, ONBOARDING_STEPS)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  bars: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: colors.border },
  barActive: { backgroundColor: colors.accent },
});
