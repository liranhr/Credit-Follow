import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { he } from '@/i18n/he';
import { colors, radii, spacing } from '@/theme';
import { formatDate, shiftDate } from '@/utils/format';
import { AppText } from './AppText';

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove' | 'chevron-forward' | 'chevron-back';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

/** Picks a day of the month (1–31). Days beyond a short month's length use its last day. */
export function DayOfMonthPicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (day: number) => void;
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="body" block>
            {label}
          </AppText>
          {hint && (
            <AppText variant="caption" color={colors.textMuted} block>
              {hint}
            </AppText>
          )}
        </View>
        <View style={styles.stepper}>
          <StepButton
            icon="remove"
            label={`${label} −`}
            onPress={() => onChange(value <= 1 ? 31 : value - 1)}
          />
          <AppText
            variant="subtitle"
            style={styles.value}
            accessibilityLabel={`${label}: ${value}`}
          >
            {value}
          </AppText>
          <StepButton
            icon="add"
            label={`${label} +`}
            onPress={() => onChange(value >= 31 ? 1 : value + 1)}
          />
        </View>
      </View>
    </View>
  );
}

/** Picks a calendar date by day steps with quick "today" / "yesterday" shortcuts. */
export function DateStepper({
  label,
  value,
  today,
  onChange,
}: {
  label: string;
  value: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const yesterday = shiftDate(today, -1);
  return (
    <View style={styles.wrapper}>
      <AppText variant="caption" color={colors.textMuted} block>
        {label}
      </AppText>
      <View style={styles.dateBox}>
        {/* RTL: the earlier day is on the right, the later day on the left. */}
        <StepButton
          icon="chevron-forward"
          label={he.transactions.previousDay}
          onPress={() => onChange(shiftDate(value, -1))}
        />
        <AppText variant="subtitle" style={styles.flex} center>
          {formatDate(value)}
        </AppText>
        <StepButton
          icon="chevron-back"
          label={he.transactions.nextDay}
          disabled={value >= today}
          onPress={() => onChange(shiftDate(value, 1))}
        />
      </View>
      <View style={styles.shortcuts}>
        {[
          { label: he.common.today, date: today },
          { label: he.common.yesterday, date: yesterday },
        ].map((s) => (
          <Pressable
            key={s.date}
            accessibilityRole="button"
            onPress={() => onChange(s.date)}
            style={[styles.shortcut, value === s.date && styles.shortcutSelected]}
          >
            <AppText
              variant="caption"
              color={value === s.date ? colors.textOnPrimary : colors.textMuted}
            >
              {s.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, alignItems: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { minWidth: 32, textAlign: 'center' },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  shortcutSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
