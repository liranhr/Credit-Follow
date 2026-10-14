import type { AuthResponse } from '@credit-follow/shared';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp, type AppOptions } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import {
  ExpenseCategoryModel,
  ExpenseTransactionModel,
  SessionModel,
  UserModel,
} from '../models/index.js';

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

/**
 * Connects Mongoose to a fresh database on the shared in-memory mongod started by
 * `globalSetup.ts`. Returns a function that drops the database and disconnects.
 */
export async function startTestDatabase(): Promise<() => Promise<void>> {
  const baseUri = inject('mongoUri');
  const uri = `${baseUri.replace(/\/?$/, '/')}test-${randomUUID()}`;
  await connectDatabase(uri);
  await Promise.all(
    [UserModel, SessionModel, ExpenseCategoryModel, ExpenseTransactionModel].map((m) =>
      m.syncIndexes(),
    ),
  );
  return async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  };
}

/** A controllable clock for deterministic cycle / token-expiry tests. */
export function createClock(initial: string) {
  let current = new Date(initial);
  return {
    now: () => current,
    set: (iso: string) => {
      current = new Date(iso);
    },
    advanceSeconds: (seconds: number) => {
      current = new Date(current.getTime() + seconds * 1000);
    },
  };
}

export function createTestApp(
  overrides: Partial<Omit<AppOptions, 'auth'>> & { auth?: Partial<AppOptions['auth']> } = {},
): Express {
  const { auth, ...rest } = overrides;
  return createApp({
    ...rest,
    auth: {
      jwtSecret: TEST_JWT_SECRET,
      devLoginEnabled: true,
      rateLimitPerMinute: 10_000,
      ...auth,
    },
  });
}

export async function devSignIn(app: Express, displayName: string): Promise<AuthResponse> {
  const res = await request(app).post('/auth/dev').send({ displayName }).expect(200);
  return res.body as AuthResponse;
}

export function bearer(tokens: { accessToken: string }): [string, string] {
  return ['Authorization', `Bearer ${tokens.accessToken}`];
}
