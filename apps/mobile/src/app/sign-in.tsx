import { APP_NAME } from '@credit-follow/shared';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import {
  SocialSignInError,
  facebookConfigured,
  googleConfigured,
  nativeSocialSignInSupported,
} from '@/auth/socialSignIn';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Banner } from '@/components/Feedback';
import { TextField } from '@/components/TextField';
import { env } from '@/config/env';
import { useAuthProviders } from '@/hooks/api';
import { he } from '@/i18n/he';
import { rtlRootStyle } from '@/i18n/rtl';
import { colors, radii, spacing } from '@/theme';
import { describeError } from '@/utils/format';

type Busy = 'google' | 'facebook' | 'dev' | null;

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithFacebook, signInDev } = useAuth();
  const providers = useAuthProviders();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [devName, setDevName] = useState('');

  const native = nativeSocialSignInSupported();
  const showGoogle = native && googleConfigured() && providers.data?.google;
  const showFacebook = native && facebookConfigured() && providers.data?.facebook;
  const showDev = env.devLoginEnabled && providers.data?.dev;

  async function run(kind: Exclude<Busy, null>, action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof SocialSignInError ? e.message : describeError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={[styles.root, rtlRootStyle]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.logo}>
          <AppText style={styles.logoText}>₪</AppText>
        </View>
        <AppText variant="display" color={colors.textOnPrimary}>
          {APP_NAME}
        </AppText>
        <AppText variant="body" color={colors.textOnPrimaryMuted} block>
          {he.signIn.tagline}
        </AppText>
      </View>

      <View style={styles.body}>
        <Card>
          <AppText variant="title" block>
            {he.signIn.title}
          </AppText>
          <AppText variant="caption" color={colors.textMuted} block>
            {he.signIn.subtitle}
          </AppText>

          {error && <Banner message={error} />}
          {providers.isError && <Banner message={he.signIn.serverUnavailable} />}

          {showGoogle && (
            <Button
              label={he.signIn.google}
              icon="logo-google"
              variant="secondary"
              loading={busy === 'google'}
              disabled={busy !== null}
              onPress={() => run('google', signInWithGoogle)}
            />
          )}
          {showFacebook && (
            <Button
              label={he.signIn.facebook}
              icon="logo-facebook"
              variant="facebook"
              loading={busy === 'facebook'}
              disabled={busy !== null}
              onPress={() => run('facebook', signInWithFacebook)}
            />
          )}

          {!native && (
            <Banner
              tone="info"
              message={Platform.OS === 'web' ? he.signIn.webNote : he.signIn.expoGoNote}
            />
          )}
          {native && providers.isSuccess && !showGoogle && !showFacebook && (
            <Banner tone="warning" message={he.signIn.notConfigured} />
          )}
        </Card>

        {showDev && (
          <Card>
            <AppText variant="subtitle" block>
              {he.signIn.devTitle}
            </AppText>
            <AppText variant="caption" color={colors.textMuted} block>
              {he.signIn.devHint}
            </AppText>
            <TextField
              label={he.signIn.devName}
              value={devName}
              onChangeText={setDevName}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={() => devName.trim() && run('dev', () => signInDev(devName.trim()))}
            />
            <Button
              label={he.signIn.devButton}
              variant="secondary"
              loading={busy === 'dev'}
              disabled={busy !== null || !devName.trim()}
              onPress={() => run('dev', () => signInDev(devName.trim()))}
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 1.5,
    borderBottomStartRadius: radii.lg,
    borderBottomEndRadius: radii.lg,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: { color: colors.primary, fontSize: 26, fontWeight: '800' },
  body: { paddingHorizontal: spacing.lg, marginTop: -spacing.xxl, gap: spacing.lg },
});
