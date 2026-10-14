import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { rtlTextStyle } from '@/i18n/rtl';
import { colors, radii, spacing, typography } from '@/theme';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Text shown inside the field at the end (left side in RTL), e.g. "₪". */
  suffix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, suffix, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText variant="caption" color={colors.textMuted} block>
          {label}
        </AppText>
      )}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          {...props}
          style={[styles.input, rtlTextStyle, style]}
        />
        {suffix && (
          <AppText variant="subtitle" color={colors.textMuted}>
            {suffix}
          </AppText>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.dangerText} block accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.textMuted} block>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', gap: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
