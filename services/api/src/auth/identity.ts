import type { IdentityProvider } from '@credit-follow/shared';

/** A user identity whose authenticity was verified with the identity provider. */
export interface VerifiedIdentity {
  provider: IdentityProvider;
  providerUserId: string;
  /** Present only when the provider asserts that the email is verified. */
  verifiedEmail?: string;
  displayName: string;
  avatarUrl?: string;
}

export type GoogleVerifier = (idToken: string) => Promise<VerifiedIdentity>;

export type FacebookVerifier = (
  input:
    | { kind: 'access_token'; accessToken: string }
    | { kind: 'limited'; authenticationToken: string; nonce: string },
) => Promise<VerifiedIdentity>;

/** Thrown by verifiers when a token is invalid; mapped to 401 by the auth routes. */
export class IdentityVerificationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'IdentityVerificationError';
  }
}
