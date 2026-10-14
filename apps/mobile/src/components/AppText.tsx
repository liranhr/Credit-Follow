import { StyleSheet, Text, type TextProps } from 'react-native';
import { rtlTextStyle } from '@/i18n/rtl';
import { colors, typography } from '@/theme';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  /** Align to the start (right) edge — use for text that spans the full width. */
  block?: boolean;
  center?: boolean;
}

export function AppText({ variant = 'body', color, block, center, style, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        typography[variant],
        color ? { color } : null,
        block && rtlTextStyle,
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  center: { textAlign: 'center' },
});
