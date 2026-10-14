import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { he } from '@/i18n/he';
import { rtlRootStyle } from '@/i18n/rtl';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function Banner({
  message,
  tone = 'error',
}: {
  message: string;
  tone?: 'error' | 'info' | 'warning' | 'success';
}) {
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.dangerText, icon: 'alert-circle' as const },
    warning: { bg: colors.warningSoft, fg: colors.warningText, icon: 'warning' as const },
    info: { bg: colors.infoSoft, fg: colors.infoText, icon: 'information-circle' as const },
    success: { bg: colors.accentSoft, fg: colors.accentText, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: palette.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <AppText variant="caption" color={palette.fg} style={styles.flex} block>
        {message}
      </AppText>
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={[styles.center, rtlRootStyle]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.center, rtlRootStyle]}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <AppText variant="body" color={colors.textMuted} center>
        {message}
      </AppText>
      {onRetry && <Button label={he.common.retry} onPress={onRetry} variant="secondary" compact />}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <AppText variant="caption" color={colors.textMuted} center>
        {message}
      </AppText>
    </View>
  );
}

export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, rtlRootStyle]}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <AppText variant="title" block>
            {title}
          </AppText>
          <AppText variant="body" color={colors.textMuted} block>
            {body}
          </AppText>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant="danger"
              onPress={onConfirm}
              loading={loading}
              style={styles.flex}
            />
            <Button
              label={he.common.cancel}
              variant="secondary"
              onPress={onCancel}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
