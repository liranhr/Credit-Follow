import type { FacebookSignInInput } from '@credit-follow/shared';
import { isRunningInExpoGo } from 'expo';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { env } from '@/config/env';
import { he } from '@/i18n/he';

/** Thrown with a user-facing Hebrew message. Cancellation resolves to null instead. */
export class SocialSignInError extends Error {}

/**
 * The Google and Facebook SDKs contain native code: they are unavailable in Expo Go and
 * on web. The modules are imported lazily so the app still runs there (with other login
 * options) instead of crashing at startup.
 */
export function nativeSocialSignInSupported(): boolean {
  return Platform.OS !== 'web' && !isRunningInExpoGo();
}

export const googleConfigured = () => Boolean(env.googleWebClientId);
export const facebookConfigured = () => env.facebookEnabled;

let googleConfiguredOnce = false;

/** Returns a Google ID token (audience = web client ID), or null if the user cancelled. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } =
    await import('@react-native-google-signin/google-signin');
  if (!googleConfiguredOnce) {
    GoogleSignin.configure({
      webClientId: env.googleWebClientId,
      ...(env.googleIosClientId && { iosClientId: env.googleIosClientId }),
    });
    googleConfiguredOnce = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new SocialSignInError(he.signIn.googleFailed);
    return response.data.idToken;
  } catch (error) {
    if (error instanceof SocialSignInError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) throw new SocialSignInError(he.signIn.inProgress);
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SocialSignInError(he.signIn.playServices);
      }
    }
    throw new SocialSignInError(he.signIn.googleFailed);
  }
}

/**
 * Facebook login. iOS uses Limited Login (required by react-native-fbsdk-next ≥ 13), which
 * returns an OpenID token bound to our nonce; Android returns a classic access token.
 */
export async function getFacebookCredentials(): Promise<FacebookSignInInput | null> {
  const { LoginManager, AccessToken, AuthenticationToken } =
    await import('react-native-fbsdk-next');
  try {
    if (Platform.OS === 'ios') {
      const nonce = Crypto.randomUUID();
      const result = await LoginManager.logInWithPermissions(['public_profile'], 'limited', nonce);
      if (result.isCancelled) return null;
      const token = await AuthenticationToken.getAuthenticationTokenIOS();
      if (!token?.authenticationToken) throw new SocialSignInError(he.signIn.facebookFailed);
      return { kind: 'limited', authenticationToken: token.authenticationToken, nonce };
    }
    const result = await LoginManager.logInWithPermissions(['public_profile']);
    if (result.isCancelled) return null;
    const token = await AccessToken.getCurrentAccessToken();
    if (!token?.accessToken) throw new SocialSignInError(he.signIn.facebookFailed);
    return { kind: 'access_token', accessToken: token.accessToken };
  } catch (error) {
    if (error instanceof SocialSignInError) throw error;
    throw new SocialSignInError(he.signIn.facebookFailed);
  }
}

/** Best-effort sign-out from the provider SDKs (so the account picker shows next time). */
export async function signOutFromProviders(): Promise<void> {
  if (!nativeSocialSignInSupported()) return;
  try {
    if (googleConfigured() && googleConfiguredOnce) {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    }
    if (facebookConfigured()) {
      const { LoginManager } = await import('react-native-fbsdk-next');
      LoginManager.logOut();
    }
  } catch {
    // Ignore — the app session is already ended.
  }
}
