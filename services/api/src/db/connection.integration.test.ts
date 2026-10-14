import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, startTestDatabase } from '../test/helpers.js';
import { ExpenseCategoryModel, ExpenseTransactionModel, UserModel } from '../models/index.js';
import { getDatabaseStatus, redactMongoUri } from './connection.js';

// Runs against a real, ephemeral mongod started by mongodb-memory-server (globalSetup).
// It does NOT verify your own MONGODB_URI — see the README for that.

let stopDb: () => Promise<void>;

beforeAll(async () => {
  // Uses connectDatabase() from ./connection.ts under the hood.
  stopDb = await startTestDatabase();
});

afterAll(async () => {
  await stopDb();
});

describe('MongoDB connection (in-memory server)', () => {
  it('reports connected via /health', async () => {
    expect(getDatabaseStatus()).toBe('connected');
    const res = await request(createTestApp()).get('/health');
    expect(res.body.database).toBe('connected');
  });

  it('persists a user, category and transaction', async () => {
    const user = await UserModel.create({
      displayName: 'משתמש בדיקה',
      authIdentities: [{ provider: 'google', providerUserId: 'g-1' }],
    });
    const category = await ExpenseCategoryModel.create({ userId: user._id, name: 'סופר' });
    await ExpenseTransactionModel.create({
      userId: user._id,
      categoryId: category._id,
      amountMinor: 25_000,
      occurredAt: new Date('2026-10-05'),
    });

    const found = await ExpenseTransactionModel.find({ userId: user._id }).lean();
    expect(found).toHaveLength(1);
    expect(found[0]?.amountMinor).toBe(25_000);
  });

  it('enforces unique auth identities and case-insensitive category names per user', async () => {
    await expect(
      UserModel.create({
        displayName: 'כפול',
        authIdentities: [{ provider: 'google', providerUserId: 'g-1' }],
      }),
    ).rejects.toMatchObject({ code: 11000 });

    const userId = (await UserModel.findOne({ 'authIdentities.providerUserId': 'g-1' }))!._id;
    await ExpenseCategoryModel.create({ userId, name: 'Food' });
    await expect(ExpenseCategoryModel.create({ userId, name: 'food' })).rejects.toMatchObject({
      code: 11000,
    });
  });
});

describe('redactMongoUri', () => {
  it('hides credentials', () => {
    expect(redactMongoUri('mongodb+srv://user:pass@cluster.example.net/db')).toBe(
      'mongodb+srv://***:***@cluster.example.net/db',
    );
    expect(redactMongoUri('mongodb://127.0.0.1:27017/db')).toBe('mongodb://127.0.0.1:27017/db');
  });
});
