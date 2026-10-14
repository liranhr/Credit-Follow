// EXPO_PUBLIC_* variables are inlined at build time by Expo's Metro config.
// They must be referenced as `process.env.EXPO_PUBLIC_*` literally (no destructuring).
// They are visible to anyone who has the app — never put secrets here.
export const env = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, ''),
  /** OAuth *web* client ID — Google issues ID tokens with this audience for the API to verify. */
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  /** OAuth iOS client ID (iOS only). */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  /** Set to "true" once the Facebook SDK is configured in the native build (app.config.ts). */
  facebookEnabled: process.env.EXPO_PUBLIC_FACEBOOK_ENABLED === 'true',
  /** Development-only passwordless login (the API must also enable it). Never in release builds. */
  devLoginEnabled: __DEV__ && process.env.EXPO_PUBLIC_DEV_LOGIN === 'true',
} as const;
