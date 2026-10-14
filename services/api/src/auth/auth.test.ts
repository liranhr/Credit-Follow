import { createHmac } from 'node:crypto';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionModel, UserModel } from '../models/index.js';
import {
  bearer,
  createClock,
  createTestApp,
  devSignIn,
  startTestDatabase,
} from '../test/helpers.js';
import { createFacebookVerifier } from './facebook.js';
import { createGoogleVerifier } from './google.js';

const GOOGLE_CLIENT_ID = 'test-web-client.apps.googleusercontent.com';
const FB_APP_ID = '1234567890';
const FB_APP_SECRET = 'fb-test-secret';

let stopDb: () => Promise<void>;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwks: ReturnType<typeof createLocalJWKSet>;
const clock = createClock('2026-10-14T09:00:00Z');

beforeAll(async () => {
  stopDb = await startTestDatabase();
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256' };
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

afterAll(async () => {
  await stopDb();
});

function signIdToken(
  claims: Record<string, unknown>,
  options: { iss?: string; aud?: string; expSeconds?: number } = {},
) {
  const iat = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.iss ?? 'https://accounts.google.com')
    .setAudience(options.aud ?? GOOGLE_CLIENT_ID)
    .setIssuedAt(iat)
    .setExpirationTime(iat + (options.expSeconds ?? 3600))
    .sign(privateKey);
}

/** Fake Graph API: one valid user token, issued to our app. */
const graphCalls: URL[] = [];
const fakeFetch = (async (input: string | URL | Request) => {
  const url = new URL(input instanceof Request ? input.url : input);
  graphCalls.push(url);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  if (url.pathname.endsWith('/debug_token')) {
    const token = url.searchParams.get('input_token');
    if (token === 'valid-fb-access-token-0123456789') {
      return json({ data: { app_id: FB_APP_ID, is_valid: true, user_id: 'fb-user-1' } });
    }
    if (token === 'other-app-fb-access-token-0123456') {
      return json({ data: { app_id: '999', is_valid: true, user_id: 'fb-user-2' } });
    }
    return json({ data: { is_valid: false } });
  }
  if (url.pathname.endsWith('/me')) {
    return json({
      id: 'fb-user-1',
      name: 'דנה כהן',
      picture: { data: { url: 'https://example.com/p.jpg', is_silhouette: false } },
    });
  }
  return new Response('{}', { status: 404 });
}) as typeof fetch;

function buildApp() {
  return createTestApp({
    now: clock.now,
    auth: {
      accessTokenTtlSeconds: 900,
      googleVerifier: createGoogleVerifier({
        clientIds: [GOOGLE_CLIENT_ID],
        keySet: jwks,
        now: clock.now,
      }),
      facebookVerifier: createFacebookVerifier({
        appId: FB_APP_ID,
        appSecret: FB_APP_SECRET,
        graphApiVersion: 'v24.0',
        fetchFn: fakeFetch,
        keySet: jwks,
        now: clock.now,
      }),
    },
  });
}

describe('GET /auth/providers', () => {
  it('reports configured providers', async () => {
    const res = await request(buildApp()).get('/auth/providers');
    expect(res.body).toEqual({ google: true, facebook: true, dev: true });
    const bare = await request(createTestApp({ auth: { devLoginEnabled: false } })).get(
      '/auth/providers',
    );
    expect(bare.body).toEqual({ google: false, facebook: false, dev: false });
  });

  it('returns 503 for unconfigured providers and 404 for disabled dev login', async () => {
    const app = createTestApp({ auth: { devLoginEnabled: false } });
    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'x'.repeat(30) });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect((await request(app).post('/auth/dev').send({ displayName: 'x' })).status).toBe(404);
  });
});

describe('Google sign-in', () => {
  it('creates a user from a valid ID token and returns a working session', async () => {
    const app = buildApp();
    const idToken = await signIdToken({
      sub: 'google-sub-1',
      email: 'Noa@Example.com',
      email_verified: true,
      name: 'נועה לוי',
    });
    const res = await request(app).post('/auth/google').send({ idToken }).expect(200);
    expect(res.body.user).toMatchObject({
      displayName: 'נועה לוי',
      email: 'noa@example.com',
      providers: ['google'],
      onboardingCompleted: false,
    });
    expect(res.body.refreshToken).toHaveLength(43);

    const me = await request(app)
      .get('/me')
      .set(...bearer(res.body))
      .expect(200);
    expect(me.body.id).toBe(res.body.user.id);

    // Signing in again returns the same user.
    const again = await request(app).post('/auth/google').send({ idToken }).expect(200);
    expect(again.body.user.id).toBe(res.body.user.id);
  });

  it.each([
    ['wrong audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['wrong issuer', { iss: 'https://evil.example.com' }],
    ['expired token', { expSeconds: -10 }],
  ])('rejects a token with %s', async (_label, options) => {
    const idToken = await signIdToken({ sub: 'google-sub-x' }, options);
    const res = await request(buildApp()).post('/auth/google').send({ idToken });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PROVIDER_TOKEN');
  });

  it('rejects a token signed with an unknown key', async () => {
    const other = await generateKeyPair('RS256');
    const idToken = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://accounts.google.com')
      .setAudience(GOOGLE_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(other.privateKey);
    expect((await request(buildApp()).post('/auth/google').send({ idToken })).status).toBe(401);
  });

  it('does not store unverified emails, and links only verified emails', async () => {
    const app = buildApp();
    const unverified = await signIdToken({
      sub: 'google-sub-unverified',
      email: 'shared@example.com',
      email_verified: false,
    });
    const first = await request(app).post('/auth/google').send({ idToken: unverified }).expect(200);
    expect(first.body.user.email).toBeUndefined();

    const verifiedA = await signIdToken({
      sub: 'google-sub-a',
      email: 'linked@example.com',
      email_verified: true,
    });
    const verifiedB = await signIdToken({
      sub: 'google-sub-b',
      email: 'LINKED@example.com',
      email_verified: true,
    });
    const a = await request(app).post('/auth/google').send({ idToken: verifiedA }).expect(200);
    const b = await request(app).post('/auth/google').send({ idToken: verifiedB }).expect(200);
    expect(b.body.user.id).toBe(a.body.user.id);
    const user = await UserModel.findById(a.body.user.id);
    expect(user?.authIdentities.map((i) => i.providerUserId).sort()).toEqual([
      'google-sub-a',
      'google-sub-b',
    ]);
  });
});

describe('Facebook sign-in', () => {
  it('verifies a classic access token with debug_token and appsecret_proof', async () => {
    graphCalls.length = 0;
    const res = await request(buildApp())
      .post('/auth/facebook')
      .send({ kind: 'access_token', accessToken: 'valid-fb-access-token-0123456789' })
      .expect(200);
    expect(res.body.user).toMatchObject({ displayName: 'דנה כהן', providers: ['facebook'] });
    expect(res.body.user.email).toBeUndefined();

    const debug = graphCalls.find((u) => u.pathname === '/v24.0/debug_token');
    expect(debug?.searchParams.get('access_token')).toBe(`${FB_APP_ID}|${FB_APP_SECRET}`);
    const me = graphCalls.find((u) => u.pathname === '/v24.0/me');
    expect(me?.searchParams.get('appsecret_proof')).toBe(
      createHmac('sha256', FB_APP_SECRET).update('valid-fb-access-token-0123456789').digest('hex'),
    );
  });

  it.each([
    ['an invalid token', 'invalid-fb-access-token-012345678'],
    ['a token issued to another app', 'other-app-fb-access-token-0123456'],
  ])('rejects %s', async (_label, accessToken) => {
    const res = await request(buildApp())
      .post('/auth/facebook')
      .send({ kind: 'access_token', accessToken });
    expect(res.status).toBe(401);
  });

  it('verifies iOS Limited Login tokens including the nonce', async () => {
    const token = await signIdToken(
      { sub: 'fb-limited-1', name: 'Limited User', nonce: 'nonce-abc-123' },
      { iss: 'https://www.facebook.com', aud: FB_APP_ID },
    );
    const app = buildApp();
    const ok = await request(app)
      .post('/auth/facebook')
      .send({ kind: 'limited', authenticationToken: token, nonce: 'nonce-abc-123' })
      .expect(200);
    expect(ok.body.user.displayName).toBe('Limited User');

    const badNonce = await request(app)
      .post('/auth/facebook')
      .send({ kind: 'limited', authenticationToken: token, nonce: 'nonce-other-999' });
    expect(badNonce.status).toBe(401);
  });
});

describe('sessions', () => {
  it('rejects missing, malformed and expired access tokens', async () => {
    const app = buildApp();
    expect((await request(app).get('/me')).status).toBe(401);
    expect((await request(app).get('/me').set('Authorization', 'Bearer nope')).status).toBe(401);

    const session = await devSignIn(app, 'expiry-user');
    await request(app)
      .get('/me')
      .set(...bearer(session))
      .expect(200);
    clock.advanceSeconds(901);
    const expired = await request(app)
      .get('/me')
      .set(...bearer(session));
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('TOKEN_INVALID');
    clock.set('2026-10-14T09:00:00Z');
  });

  it('rejects access tokens signed with a different secret', async () => {
    const other = createTestApp({
      auth: { jwtSecret: 'another-secret-that-is-32-characters-plus' },
    });
    const session = await devSignIn(other, 'secret-user');
    expect(
      (
        await request(buildApp())
          .get('/me')
          .set(...bearer(session))
      ).status,
    ).toBe(401);
  });

  it('rotates refresh tokens and revokes the session when an old one is reused', async () => {
    const app = buildApp();
    const first = await devSignIn(app, 'rotation-user');

    const second = (
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200)
    ).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await request(app)
      .get('/me')
      .set(...bearer(second))
      .expect(200);

    // Replaying the first (already rotated) refresh token = possible theft.
    const replay = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);

    // The whole session is now revoked: neither the new refresh nor access token works.
    expect(
      (await request(app).post('/auth/refresh').send({ refreshToken: second.refreshToken })).status,
    ).toBe(401);
    const me = await request(app)
      .get('/me')
      .set(...bearer(second));
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');

    const session = await SessionModel.findOne({ userId: first.user.id });
    expect(session?.revokedReason).toBe('reuse_detected');
  });

  it('logout revokes the session', async () => {
    const app = buildApp();
    const session = await devSignIn(app, 'logout-user');
    await request(app)
      .post('/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);
    expect(
      (
        await request(app)
          .get('/me')
          .set(...bearer(session))
      ).status,
    ).toBe(401);
    expect(
      (await request(app).post('/auth/refresh').send({ refreshToken: session.refreshToken }))
        .status,
    ).toBe(401);
  });

  it('stores only a hash of the refresh token', async () => {
    const app = buildApp();
    const session = await devSignIn(app, 'hash-user');
    const stored = await SessionModel.findOne({ userId: session.user.id }).lean();
    expect(stored?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(session.refreshToken);
  });
});
