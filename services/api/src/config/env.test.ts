import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('parses a valid environment with defaults', () => {
    const env = loadEnv({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/credit-follow',
      JWT_SECRET: 'x'.repeat(32),
    });
    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/credit-follow',
      CORS_ORIGINS: [],
      TRUST_PROXY: false,
      JWT_SECRET: 'x'.repeat(32),
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      GOOGLE_CLIENT_IDS: [],
      FACEBOOK_GRAPH_API_VERSION: 'v24.0',
      AUTH_DEV_LOGIN_ENABLED: false,
    });
  });

  it('splits CORS origins', () => {
    const env = loadEnv({
      MONGODB_URI: 'mongodb+srv://cluster.example.net/db',
      JWT_SECRET: 'x'.repeat(32),
      CORS_ORIGINS: 'http://localhost:8081, http://localhost:19006',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:8081', 'http://localhost:19006']);
  });

  it('fails clearly when MONGODB_URI is missing or invalid', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
    expect(() => loadEnv({ MONGODB_URI: 'postgres://x' })).toThrow(/mongodb:\/\//);
  });

  it('requires a long JWT secret', () => {
    expect(() => loadEnv({ MONGODB_URI: 'mongodb://h/db' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ MONGODB_URI: 'mongodb://h/db', JWT_SECRET: 'short' })).toThrow(/32/);
  });

  it('parses provider settings and enforces safe combinations', () => {
    const base = { MONGODB_URI: 'mongodb://h/db', JWT_SECRET: 'x'.repeat(32) };
    const env = loadEnv({
      ...base,
      GOOGLE_CLIENT_IDS: 'a.apps.googleusercontent.com, b.apps.googleusercontent.com',
      FACEBOOK_APP_ID: '123',
      FACEBOOK_APP_SECRET: 'secret',
      AUTH_DEV_LOGIN_ENABLED: 'true',
    });
    expect(env.GOOGLE_CLIENT_IDS).toHaveLength(2);
    expect(env.AUTH_DEV_LOGIN_ENABLED).toBe(true);
    expect(() => loadEnv({ ...base, FACEBOOK_APP_ID: '123' })).toThrow(/together/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', AUTH_DEV_LOGIN_ENABLED: 'true' }),
    ).toThrow(/production/);
  });
});
