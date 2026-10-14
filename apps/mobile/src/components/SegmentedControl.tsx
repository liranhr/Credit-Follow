import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Wrap onto multiple lines as chips instead of a single segmented row. */
  wrap?: boolean;
  label?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  wrap,
  label,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText variant="caption" color={colors.textMuted} block>
          {label}
        </AppText>
      )}
      <View
        style={[styles.row, wrap ? styles.wrap : styles.segmented]}
        accessibilityRole="radiogroup"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={[
                wrap ? styles.chip : styles.segment,
                selected && (wrap ? styles.chipSelected : styles.segmentSelected),
              ]}
            >
              <AppText
                variant="caption"
                color={selected ? (wrap ? colors.textOnPrimary : colors.primary) : colors.textMuted}
                center
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', gap: spacing.xs },
  row: { flexDirection: 'row' },
  segmented: {
    backgroundColor: colors.border,
    borderRadius: radii.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.surface },
  wrap: { flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
