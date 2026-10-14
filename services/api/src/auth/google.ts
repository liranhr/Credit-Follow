import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IdentityVerificationError, type GoogleVerifier } from './identity.js';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Verifies a Google ID token locally against Google's published signing keys:
 * signature (RS256), issuer, audience (our OAuth client IDs) and expiry.
 * See https://developers.google.com/identity/sign-in/web/backend-auth
 */
export function createGoogleVerifier(options: {
  clientIds: string[];
  /** Override for tests; defaults to Google's remote JWKS (cached by jose). */
  keySet?: JWTVerifyGetKey;
  now?: () => Date;
}): GoogleVerifier {
  if (options.clientIds.length === 0) {
    throw new Error('At least one Google client ID is required');
  }
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

  return async (idToken) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, keySet, {
        issuer: GOOGLE_ISSUERS,
        audience: options.clientIds,
        algorithms: ['RS256'],
        ...(options.now && { currentDate: options.now() }),
      }));
    } catch (error) {
      throw new IdentityVerificationError('Invalid Google ID token', { cause: error });
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new IdentityVerificationError('Google ID token has no subject');
    }

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const name = typeof payload.name === 'string' && payload.name ? payload.name : undefined;
    const picture = typeof payload.picture === 'string' ? payload.picture : undefined;

    return {
      provider: 'google',
      providerUserId: payload.sub,
      ...(email && emailVerified && { verifiedEmail: email }),
      displayName: name ?? email?.split('@')[0] ?? 'משתמש Google',
      ...(picture && { avatarUrl: picture }),
    };
  };
}
