import { z } from 'zod';
import type { UserDto } from './user.js';

export const googleSignInSchema = z.object({
  /** Google ID token (JWT) obtained by the app with the web client ID as audience. */
  idToken: z.string().min(20).max(4096),
});

export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

export const facebookSignInSchema = z.discriminatedUnion('kind', [
  z.object({
    /** Classic Facebook Login (Android, web): a user access token. */
    kind: z.literal('access_token'),
    accessToken: z.string().min(20).max(4096),
  }),
  z.object({
    /** iOS Limited Login: an OpenID Connect token plus the nonce the app used. */
    kind: z.literal('limited'),
    authenticationToken: z.string().min(20).max(8192),
    nonce: z.string().min(8).max(200),
  }),
]);

export type FacebookSignInInput = z.infer<typeof facebookSignInSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** Development-only login (disabled unless AUTH_DEV_LOGIN_ENABLED=true outside production). */
export const devSignInSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export interface AuthTokens {
  accessToken: string;
  /** ISO timestamp. */
  accessTokenExpiresAt: string;
  refreshToken: string;
  /** ISO timestamp. */
  refreshTokenExpiresAt: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserDto;
}

export interface AuthProvidersStatus {
  google: boolean;
  facebook: boolean;
  dev: boolean;
}
