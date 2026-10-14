import type { FacebookVerifier, GoogleVerifier } from './auth/identity.js';
import type { SessionService } from './auth/session.service.js';
import type { AccessTokenService } from './auth/tokens.js';

/** Dependencies shared by the API routes (injected so tests can control them). */
export interface ApiDeps {
  now: () => Date;
  accessTokens: AccessTokenService;
  sessions: SessionService;
  /** Undefined when the provider is not configured. */
  googleVerifier?: GoogleVerifier;
  facebookVerifier?: FacebookVerifier;
  devLoginEnabled: boolean;
  /** Max sign-in / refresh requests per IP per minute. */
  authRateLimitPerMinute: number;
}
