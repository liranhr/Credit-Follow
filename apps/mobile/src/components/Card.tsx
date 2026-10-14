import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/theme';
import { AppText } from './AppText';

interface CardProps extends PropsWithChildren {
  title?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ title, action, style, children }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.header}>
          {title ? <AppText variant="subtitle">{title}</AppText> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
