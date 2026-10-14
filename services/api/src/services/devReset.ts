import { DEFAULT_FINANCIAL_CYCLE } from '@credit-follow/shared';
import type { Types } from 'mongoose';
import {
  ExpenseCategoryModel,
  ExpenseTransactionModel,
  SessionModel,
  UserModel,
} from '../models/index.js';

/** Throws unless running outside production. Used by the development reset script. */
export function assertDevelopmentEnvironment(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to run: the development reset is disabled when NODE_ENV=production');
  }
}

export interface UserDataCounts {
  categories: number;
  fixedExpenses: number;
  variableBudgets: number;
  transactions: number;
  sessions: number;
}

export async function countUserData(userId: Types.ObjectId): Promise<UserDataCounts> {
  const [categories, fixedExpenses, transactions, sessions] = await Promise.all([
    ExpenseCategoryModel.countDocuments({ userId }),
    ExpenseCategoryModel.countDocuments({ userId, kind: 'fixed' }),
    ExpenseTransactionModel.countDocuments({ userId }),
    SessionModel.countDocuments({ userId }),
  ]);
  return {
    categories,
    fixedExpenses,
    variableBudgets: categories - fixedExpenses,
    transactions,
    sessions,
  };
}

/**
 * Resets ONE user to a brand-new state so onboarding starts from step 1:
 * deletes their fixed expenses, variable budgets, transactions and sessions (forcing a fresh
 * sign-in) and resets their income, savings goal, financial cycle and onboarding status.
 * The user document itself is kept, so the same Google/Facebook identity signs back in.
 * Nothing belonging to other users is touched — every query is scoped by `userId`.
 */
export async function resetUserData(userId: Types.ObjectId): Promise<UserDataCounts> {
  const before = await countUserData(userId);
  await ExpenseTransactionModel.deleteMany({ userId });
  await ExpenseCategoryModel.deleteMany({ userId });
  await SessionModel.deleteMany({ userId });
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        'finance.averageMonthlyIncomeMinor': 0,
        'finance.monthlySavingsGoalMinor': 0,
        'preferences.financialCycle': { ...DEFAULT_FINANCIAL_CYCLE },
      },
      $unset: { onboardingCompletedAt: 1 },
    },
  );
  return before;
}

async function existingUserIds(): Promise<Types.ObjectId[]> {
  return (await UserModel.find({}, { _id: 1 }).lean()).map((u) => u._id);
}

/** Sessions whose user no longer exists (left behind by deleted test accounts). */
export async function countOrphanSessions(): Promise<number> {
  return SessionModel.countDocuments({ userId: { $nin: await existingUserIds() } });
}

export async function deleteOrphanSessions(): Promise<number> {
  const result = await SessionModel.deleteMany({ userId: { $nin: await existingUserIds() } });
  return result.deletedCount;
}
