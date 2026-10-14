import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createSessionService } from './auth/session.service.js';
import { createAccessTokenService } from './auth/tokens.js';
import type { FacebookVerifier, GoogleVerifier } from './auth/identity.js';
import type { ApiDeps } from './deps.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { createAuthRouter } from './routes/auth.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { healthRouter } from './routes/health.js';
import { createMeRouter } from './routes/me.js';
import { createOnboardingRouter } from './routes/onboarding.js';
import { createTransactionsRouter } from './routes/transactions.js';

export interface AppOptions {
  auth: {
    jwtSecret: string;
    accessTokenTtlSeconds?: number;
    refreshTokenTtlDays?: number;
    googleVerifier?: GoogleVerifier;
    facebookVerifier?: FacebookVerifier;
    devLoginEnabled?: boolean;
    /** Max sign-in / refresh requests per IP per minute (default 20). */
    rateLimitPerMinute?: number;
  };
  corsOrigins?: string[];
  exposeErrorStack?: boolean;
  /** Trust the first proxy hop for client IPs (rate limiting behind a load balancer). */
  trustProxy?: boolean;
  /** Clock override for tests. */
  now?: () => Date;
  /** Hook for registering extra routes (used by tests). */
  registerRoutes?: (app: Express) => void;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  const now = options.now ?? (() => new Date());

  const accessTokens = createAccessTokenService({
    secret: options.auth.jwtSecret,
    ttlSeconds: options.auth.accessTokenTtlSeconds ?? 900,
    now,
  });
  const deps: ApiDeps = {
    now,
    accessTokens,
    sessions: createSessionService({
      accessTokens,
      refreshTokenTtlDays: options.auth.refreshTokenTtlDays ?? 30,
      now,
    }),
    ...(options.auth.googleVerifier && { googleVerifier: options.auth.googleVerifier }),
    ...(options.auth.facebookVerifier && { facebookVerifier: options.auth.facebookVerifier }),
    devLoginEnabled: options.auth.devLoginEnabled ?? false,
    authRateLimitPerMinute: options.auth.rateLimitPerMinute ?? 20,
  };

  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: options.corsOrigins && options.corsOrigins.length > 0 ? options.corsOrigins : true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/auth', createAuthRouter(deps));

  const authenticated = requireAuth(deps);
  app.use('/me', authenticated, createMeRouter(deps));
  app.use('/onboarding', authenticated, createOnboardingRouter(deps));
  app.use('/categories', authenticated, createCategoriesRouter());
  app.use('/transactions', authenticated, createTransactionsRouter(deps));
  app.use('/dashboard', authenticated, createDashboardRouter(deps));

  options.registerRoutes?.(app);

  app.use(notFoundHandler);
  app.use(createErrorHandler({ exposeStack: options.exposeErrorStack ?? false }));

  return app;
}
