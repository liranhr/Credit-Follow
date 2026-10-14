import {
  devSignInSchema,
  facebookSignInSchema,
  googleSignInSchema,
  refreshTokenSchema,
  type AuthProvidersStatus,
  type AuthResponse,
} from '@credit-follow/shared';
import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { findOrCreateUserForIdentity } from '../auth/auth.service.js';
import { IdentityVerificationError, type VerifiedIdentity } from '../auth/identity.js';
import type { ApiDeps } from '../deps.js';
import { HttpError } from '../errors/HttpError.js';
import { UserModel } from '../models/user.model.js';
import { getValidated, validate } from '../middleware/validate.js';
import { toUserDto } from '../services/serializers.js';

const PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED';

export function createAuthRouter(deps: ApiDeps): Router {
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: deps.authRateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'TOO_MANY_REQUESTS', 'יותר מדי ניסיונות, נסו שוב בעוד דקה')),
  });

  async function signIn(
    req: Request,
    verify: () => Promise<VerifiedIdentity>,
  ): Promise<AuthResponse> {
    let identity: VerifiedIdentity;
    try {
      identity = await verify();
    } catch (error) {
      if (error instanceof IdentityVerificationError) {
        throw new HttpError(401, 'INVALID_PROVIDER_TOKEN', 'האימות מול ספק ההתחברות נכשל');
      }
      throw error;
    }
    const user = await findOrCreateUserForIdentity(identity, deps.now());
    const { userId: _userId, ...tokens } = await deps.sessions.create(
      user._id,
      req.get('user-agent'),
    );
    return { ...tokens, user: toUserDto(user) };
  }

  router.get('/providers', (_req, res) => {
    const status: AuthProvidersStatus = {
      google: Boolean(deps.googleVerifier),
      facebook: Boolean(deps.facebookVerifier),
      dev: deps.devLoginEnabled,
    };
    res.json(status);
  });

  const googleSchemas = { body: googleSignInSchema };
  router.post('/google', limiter, validate(googleSchemas), async (req, res) => {
    const verifier = deps.googleVerifier;
    if (!verifier) {
      throw HttpError.serviceUnavailable(
        PROVIDER_NOT_CONFIGURED,
        'התחברות עם Google אינה מוגדרת בשרת',
      );
    }
    const { idToken } = getValidated(res, googleSchemas).body;
    res.json(await signIn(req, () => verifier(idToken)));
  });

  const facebookSchemas = { body: facebookSignInSchema };
  router.post('/facebook', limiter, validate(facebookSchemas), async (req, res) => {
    const verifier = deps.facebookVerifier;
    if (!verifier) {
      throw HttpError.serviceUnavailable(
        PROVIDER_NOT_CONFIGURED,
        'התחברות עם Facebook אינה מוגדרת בשרת',
      );
    }
    const input = getValidated(res, facebookSchemas).body;
    res.json(await signIn(req, () => verifier(input)));
  });

  if (deps.devLoginEnabled) {
    const devSchemas = { body: devSignInSchema };
    router.post('/dev', limiter, validate(devSchemas), async (req, res) => {
      const { displayName } = getValidated(res, devSchemas).body;
      res.json(
        await signIn(req, async () => ({
          provider: 'dev',
          // The display name doubles as the identity, so the same name = the same dev user.
          providerUserId: displayName.toLowerCase(),
          displayName,
        })),
      );
    });
  }

  const refreshSchemas = { body: refreshTokenSchema };
  router.post('/refresh', limiter, validate(refreshSchemas), async (_req, res) => {
    const { refreshToken } = getValidated(res, refreshSchemas).body;
    const { userId, ...tokens } = await deps.sessions.refresh(refreshToken);
    const user = await UserModel.findById(userId);
    if (!user) throw HttpError.unauthorized('המשתמש לא נמצא');
    const body: AuthResponse = { ...tokens, user: toUserDto(user) };
    res.json(body);
  });

  router.post('/logout', validate(refreshSchemas), async (_req, res) => {
    await deps.sessions.revoke(getValidated(res, refreshSchemas).body.refreshToken);
    res.status(204).end();
  });

  return router;
}
