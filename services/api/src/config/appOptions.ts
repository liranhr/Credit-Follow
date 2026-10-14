import type { AppOptions } from '../app.js';
import { createFacebookVerifier } from '../auth/facebook.js';
import { createGoogleVerifier } from '../auth/google.js';
import type { Env } from './env.js';

/** Builds the app configuration (including the identity verifiers) from the environment. */
export function appOptionsFromEnv(env: Env): AppOptions {
  return {
    corsOrigins: env.CORS_ORIGINS,
    exposeErrorStack: env.NODE_ENV === 'development',
    trustProxy: env.TRUST_PROXY,
    auth: {
      jwtSecret: env.JWT_SECRET,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      devLoginEnabled: env.AUTH_DEV_LOGIN_ENABLED,
      ...(env.GOOGLE_CLIENT_IDS.length > 0 && {
        googleVerifier: createGoogleVerifier({ clientIds: env.GOOGLE_CLIENT_IDS }),
      }),
      ...(env.FACEBOOK_APP_ID &&
        env.FACEBOOK_APP_SECRET && {
          facebookVerifier: createFacebookVerifier({
            appId: env.FACEBOOK_APP_ID,
            appSecret: env.FACEBOOK_APP_SECRET,
            graphApiVersion: env.FACEBOOK_GRAPH_API_VERSION,
          }),
        }),
    },
  };
}

export function describeAuthProviders(env: Env): string {
  const enabled = [
    env.GOOGLE_CLIENT_IDS.length > 0 && 'google',
    env.FACEBOOK_APP_ID && 'facebook',
    env.AUTH_DEV_LOGIN_ENABLED && 'dev (development only)',
  ].filter(Boolean);
  return enabled.length > 0
    ? enabled.join(', ')
    : 'none — configure GOOGLE_CLIENT_IDS / FACEBOOK_APP_ID';
}
