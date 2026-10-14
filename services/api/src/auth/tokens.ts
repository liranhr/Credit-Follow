import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'credit-follow-api';
const AUDIENCE = 'credit-follow-app';

export interface AccessTokenPayload {
  userId: string;
  sessionId: string;
}

export interface AccessTokenService {
  sign(payload: AccessTokenPayload): Promise<{ token: string; expiresAt: Date }>;
  /** Throws if the token is invalid, expired, or not issued by this API. */
  verify(token: string): Promise<AccessTokenPayload>;
}

/** Short-lived HS256 JWT access tokens signed with JWT_SECRET. */
export function createAccessTokenService(options: {
  secret: string;
  ttlSeconds: number;
  now?: () => Date;
}): AccessTokenService {
  const key = new TextEncoder().encode(options.secret);
  const now = options.now ?? (() => new Date());

  return {
    async sign({ userId, sessionId }) {
      const issuedAt = Math.floor(now().getTime() / 1000);
      const expiresAtSeconds = issuedAt + options.ttlSeconds;
      const token = await new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAtSeconds)
        .sign(key);
      return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
    },

    async verify(token) {
      const { payload } = await jwtVerify(token, key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
        currentDate: now(),
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Malformed access token');
      }
      return { userId: payload.sub, sessionId: payload.sid };
    },
  };
}

/** 256-bit random opaque refresh token (base64url). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
