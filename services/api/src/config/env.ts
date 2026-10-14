import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const csvList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const booleanFlag = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => value === 'true');

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    MONGODB_URI: z
      .string({ error: 'MONGODB_URI is required' })
      .trim()
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
    CORS_ORIGINS: csvList,
    /** Set to true when running behind a reverse proxy / load balancer (for client IPs). */
    TRUST_PROXY: booleanFlag,

    JWT_SECRET: z
      .string({ error: 'JWT_SECRET is required' })
      .min(32, 'JWT_SECRET must be at least 32 characters (use a long random value)'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    /** OAuth client IDs accepted as the `aud` of Google ID tokens (the web client ID). */
    GOOGLE_CLIENT_IDS: csvList,
    FACEBOOK_APP_ID: optionalString,
    FACEBOOK_APP_SECRET: optionalString,
    FACEBOOK_GRAPH_API_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/, 'FACEBOOK_GRAPH_API_VERSION must look like v24.0')
      .default('v24.0'),

    /** Development-only passwordless login. Refused in production. */
    AUTH_DEV_LOGIN_ENABLED: booleanFlag,
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.FACEBOOK_APP_ID) !== Boolean(env.FACEBOOK_APP_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['FACEBOOK_APP_SECRET'],
        message: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set together',
      });
    }
    if (env.AUTH_DEV_LOGIN_ENABLED && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEV_LOGIN_ENABLED'],
        message: 'AUTH_DEV_LOGIN_ENABLED must not be enabled in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Loads `.env` from the current working directory if it exists (values already set win). */
function loadDotEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export function loadEnvFromProcess(): Env {
  loadDotEnvFile();
  return loadEnv(process.env);
}
