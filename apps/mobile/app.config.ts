import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. The native sign-in SDKs are only configured when their
 * (non-secret, app-embedded) identifiers are provided — see README "Authentication setup".
 *
 * Build-time variables (read when running `expo prebuild` / `expo run:*` / EAS Build):
 * - APP_BUNDLE_ID            iOS bundle identifier and Android package (default com.creditfollow.app)
 * - GOOGLE_IOS_URL_SCHEME    reversed iOS client ID, e.g. com.googleusercontent.apps.123-abc
 * - FACEBOOK_APP_ID          Facebook app ID
 * - FACEBOOK_CLIENT_TOKEN    Facebook client token (Settings → Advanced → Client token)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleId = process.env.APP_BUNDLE_ID || 'com.creditfollow.app';
  const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN;

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    ['expo-localization', { supportsRTL: true, forcesRTL: true }],
    'expo-secure-store',
    'expo-splash-screen',
    // Long-path-capable CMake/ninja for the Android C++ build on Windows.
    './plugins/withAndroidCmakeVersion',
  ];

  if (googleIosUrlScheme) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  }
  if (facebookAppId && facebookClientToken) {
    plugins.push([
      'react-native-fbsdk-next',
      {
        appID: facebookAppId,
        clientToken: facebookClientToken,
        displayName: 'Credit Follow',
        scheme: `fb${facebookAppId}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
        iosUserTrackingPermission: false,
      },
    ]);
  }

  return {
    ...config,
    name: 'Credit Follow',
    slug: 'credit-follow',
    scheme: 'creditfollow',
    version: '0.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        backgroundColor: '#0F2A4A',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
  };
};
