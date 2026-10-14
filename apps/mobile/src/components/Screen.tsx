import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { he } from '@/i18n/he';
import { rtlRootStyle } from '@/i18n/rtl';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  /** Show a back button in the header. */
  back?: boolean;
  headerAction?: ReactNode;
  /** Pinned to the bottom (e.g. primary buttons). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Standard screen: RTL root, safe areas, header, scrollable content and optional footer. */
export function Screen({
  title,
  subtitle,
  back,
  headerAction,
  footer,
  refreshing,
  onRefresh,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[styles.root, rtlRootStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {(title || back) && (
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={he.common.back}
                hitSlop={12}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={styles.backButton}
              >
                {/* In RTL, "back" points to the right. */}
                <Ionicons name="arrow-forward" size={24} color={colors.text} />
              </Pressable>
            )}
            <View style={styles.titles}>
              {title && (
                <AppText variant="title" block>
                  {title}
                </AppText>
              )}
              {subtitle && (
                <AppText variant="caption" color={colors.textMuted} block>
                  {subtitle}
                </AppText>
              )}
            </View>
            {headerAction}
          </View>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          !title && !back && { paddingTop: insets.top + spacing.lg },
          !footer && { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { padding: spacing.xs },
  titles: { flex: 1, alignItems: 'flex-start' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
