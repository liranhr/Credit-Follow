import { DEFAULT_FINANCIAL_CYCLE } from '@credit-follow/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ExpenseCategoryModel,
  ExpenseTransactionModel,
  SessionModel,
  UserModel,
} from '../models/index.js';
import { startTestDatabase } from '../test/helpers.js';
import {
  assertDevelopmentEnvironment,
  countOrphanSessions,
  countUserData,
  deleteOrphanSessions,
  resetUserData,
} from './devReset.js';

let stopDb: () => Promise<void>;

async function seedUser(name: string) {
  const user = await UserModel.create({
    displayName: name,
    email: `${name}@example.com`,
    authIdentities: [{ provider: 'google', providerUserId: `g-${name}` }],
    finance: { averageMonthlyIncomeMinor: 1_500_000, monthlySavingsGoalMinor: 80_000 },
    preferences: {
      financialCycle: { ...DEFAULT_FINANCIAL_CYCLE, anchor: 'salary', salaryDay: 10 },
    },
    onboardingCompletedAt: new Date(),
  });
  const [fixed, variable] = await ExpenseCategoryModel.create([
    { userId: user._id, name: 'שכר דירה', kind: 'fixed', monthlyBudgetMinor: 500_000 },
    { userId: user._id, name: 'סופר', kind: 'variable', monthlyBudgetMinor: 200_000 },
  ]);
  await ExpenseTransactionModel.create([
    { userId: user._id, categoryId: variable!._id, amountMinor: 10_000, occurredAt: new Date() },
    { userId: user._id, categoryId: fixed!._id, amountMinor: 500_000, occurredAt: new Date() },
  ]);
  await SessionModel.create({
    userId: user._id,
    refreshTokenHash: `hash-${name}`,
    expiresAt: new Date(Date.now() + 86_400_000),
    lastUsedAt: new Date(),
  });
  return user;
}

beforeAll(async () => {
  stopDb = await startTestDatabase();
});

afterAll(async () => {
  await stopDb();
});

describe('development reset', () => {
  it('refuses to run in production', () => {
    expect(() => assertDevelopmentEnvironment('production')).toThrow(/production/);
    expect(() => assertDevelopmentEnvironment('development')).not.toThrow();
  });

  it('resets only the chosen user and keeps their account and identity', async () => {
    const tester = await seedUser('tester');
    const other = await seedUser('other');

    const removed = await resetUserData(tester._id);
    expect(removed).toEqual({
      categories: 2,
      fixedExpenses: 1,
      variableBudgets: 1,
      transactions: 2,
      sessions: 1,
    });

    expect(await countUserData(tester._id)).toEqual({
      categories: 0,
      fixedExpenses: 0,
      variableBudgets: 0,
      transactions: 0,
      sessions: 0,
    });
    const reset = await UserModel.findById(tester._id).lean();
    expect(reset).toMatchObject({
      displayName: 'tester',
      email: 'tester@example.com',
      authIdentities: [{ provider: 'google', providerUserId: 'g-tester' }],
      finance: { averageMonthlyIncomeMinor: 0, monthlySavingsGoalMinor: 0 },
      preferences: { financialCycle: DEFAULT_FINANCIAL_CYCLE },
    });
    expect(reset?.onboardingCompletedAt).toBeUndefined();

    // The other user is untouched.
    expect(await countUserData(other._id)).toEqual({
      categories: 2,
      fixedExpenses: 1,
      variableBudgets: 1,
      transactions: 2,
      sessions: 1,
    });
    const untouched = await UserModel.findById(other._id).lean();
    expect(untouched?.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(untouched?.finance.averageMonthlyIncomeMinor).toBe(1_500_000);
  });

  it('deletes only sessions whose user no longer exists', async () => {
    await SessionModel.create({
      userId: new Types.ObjectId(),
      refreshTokenHash: 'orphan-hash',
      expiresAt: new Date(Date.now() + 86_400_000),
      lastUsedAt: new Date(),
    });
    expect(await countOrphanSessions()).toBe(1);
    expect(await deleteOrphanSessions()).toBe(1);
    expect(await SessionModel.countDocuments({ refreshTokenHash: 'hash-other' })).toBe(1);
  });
});
