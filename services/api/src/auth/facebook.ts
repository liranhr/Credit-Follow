import { createHmac } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IdentityVerificationError, type FacebookVerifier } from './identity.js';

// From https://limited.facebook.com/.well-known/openid-configuration/
const FACEBOOK_OIDC_ISSUER = 'https://www.facebook.com';
const FACEBOOK_JWKS_URL = 'https://www.facebook.com/.well-known/oauth/openid/jwks/';

interface DebugTokenResponse {
  data?: { app_id?: string; is_valid?: boolean; user_id?: string; type?: string };
  error?: { message?: string };
}

interface MeResponse {
  id?: string;
  name?: string;
  picture?: { data?: { url?: string; is_silhouette?: boolean } };
  error?: { message?: string };
}

/**
 * Verifies Facebook logins:
 * - Classic login (access token): `debug_token` with the app access token confirms the
 *   token is valid and was issued to *our* app, then `/me` (with `appsecret_proof`)
 *   returns the profile.
 * - iOS Limited Login: the OIDC authentication token is verified against Facebook's JWKS
 *   (signature, issuer, audience = app ID, expiry) and the nonce must match.
 *
 * Facebook emails are not stored because the Graph API does not say whether they are
 * verified (see auth.service.ts for why that matters for account linking).
 */
export function createFacebookVerifier(options: {
  appId: string;
  appSecret: string;
  graphApiVersion: string;
  fetchFn?: typeof fetch;
  keySet?: JWTVerifyGetKey;
  now?: () => Date;
}): FacebookVerifier {
  const fetchFn = options.fetchFn ?? fetch;
  const graph = `https://graph.facebook.com/${options.graphApiVersion}`;
  let keySet = options.keySet;

  async function getJson<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new Error('Facebook Graph API request failed', { cause: error });
    }
    return (await response.json()) as T;
  }

  return async (input) => {
    if (input.kind === 'limited') {
      keySet ??= createRemoteJWKSet(new URL(FACEBOOK_JWKS_URL));
      let payload;
      try {
        ({ payload } = await jwtVerify(input.authenticationToken, keySet, {
          issuer: FACEBOOK_OIDC_ISSUER,
          audience: options.appId,
          algorithms: ['RS256'],
          ...(options.now && { currentDate: options.now() }),
        }));
      } catch (error) {
        throw new IdentityVerificationError('Invalid Facebook authentication token', {
          cause: error,
        });
      }
      if (payload.nonce !== input.nonce) {
        throw new IdentityVerificationError('Facebook authentication token nonce mismatch');
      }
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new IdentityVerificationError('Facebook authentication token has no subject');
      }
      const name = typeof payload.name === 'string' && payload.name ? payload.name : undefined;
      const picture = typeof payload.picture === 'string' ? payload.picture : undefined;
      return {
        provider: 'facebook',
        providerUserId: payload.sub,
        displayName: name ?? 'משתמש Facebook',
        ...(picture && { avatarUrl: picture }),
      };
    }

    const debugUrl = new URL(`${graph}/debug_token`);
    debugUrl.searchParams.set('input_token', input.accessToken);
    debugUrl.searchParams.set('access_token', `${options.appId}|${options.appSecret}`);
    const debug = await getJson<DebugTokenResponse>(debugUrl);
    const data = debug.data;
    if (!data?.is_valid || data.app_id !== options.appId || !data.user_id) {
      throw new IdentityVerificationError('Invalid Facebook access token');
    }

    const meUrl = new URL(`${graph}/me`);
    meUrl.searchParams.set('fields', 'id,name,picture.type(large)');
    meUrl.searchParams.set('access_token', input.accessToken);
    meUrl.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', options.appSecret).update(input.accessToken).digest('hex'),
    );
    const me = await getJson<MeResponse>(meUrl);
    if (!me.id || me.id !== data.user_id) {
      throw new IdentityVerificationError('Facebook profile does not match the access token');
    }

    const pictureUrl = me.picture?.data?.is_silhouette ? undefined : me.picture?.data?.url;
    return {
      provider: 'facebook',
      providerUserId: me.id,
      displayName: me.name || 'משתמש Facebook',
      ...(pictureUrl && { avatarUrl: pictureUrl }),
    };
  };
}
