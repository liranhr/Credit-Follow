/**
 * Development-only: reset ONE test user so onboarding can be tested from scratch.
 *
 *   npm run dev:reset-user -w @credit-follow/api -- --email you@example.com            (dry run)
 *   npm run dev:reset-user -w @credit-follow/api -- --email you@example.com --execute  (reset)
 *   … --user-id <mongo id>          identify the user by id instead of email
 *   … --orphan-sessions             also delete sessions of users that no longer exist
 *
 * Refuses to run when NODE_ENV=production. Without --execute nothing is changed.
 * Never drops collections or touches other users' records.
 */
import mongoose, { Types } from 'mongoose';
import { loadEnvFromProcess } from '../config/env.js';
import { redactMongoUri } from '../db/connection.js';
import { UserModel } from '../models/index.js';
import {
  assertDevelopmentEnvironment,
  countOrphanSessions,
  countUserData,
  deleteOrphanSessions,
  resetUserData,
} from '../services/devReset.js';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const env = loadEnvFromProcess();
  assertDevelopmentEnvironment(env.NODE_ENV);

  const email = argValue('--email')?.trim().toLowerCase();
  const userId = argValue('--user-id');
  const execute = process.argv.includes('--execute');
  const orphanSessions = process.argv.includes('--orphan-sessions');
  if (!email === !userId) {
    throw new Error('Specify exactly one of --email <address> or --user-id <id>');
  }
  if (userId && !Types.ObjectId.isValid(userId)) throw new Error(`Invalid --user-id: ${userId}`);

  await mongoose.connect(env.MONGODB_URI);
  try {
    const db = mongoose.connection.db!;
    console.info(`Database: ${db.databaseName} (${redactMongoUri(env.MONGODB_URI)})`);

    const matches = await UserModel.find(userId ? { _id: userId } : { email }).lean();
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly 1 matching user, found ${matches.length}. Nothing changed.`,
      );
    }
    const user = matches[0]!;
    const counts = await countUserData(user._id);
    console.info(
      `User: ${user._id.toString()} "${user.displayName}" ` +
        `providers=${user.authIdentities.map((i) => i.provider).join(',')} ` +
        `onboarded=${Boolean(user.onboardingCompletedAt)}`,
    );
    console.info(
      `Will delete: ${counts.fixedExpenses} fixed expenses, ${counts.variableBudgets} variable budgets ` +
        `(expensecategories), ${counts.transactions} transactions (expensetransactions), ` +
        `${counts.sessions} sessions (sessions).`,
    );
    console.info(
      'Will reset on the user: onboarding status, income, savings goal, financial cycle. ' +
        'Kept: the user record, name, email and sign-in identities.',
    );
    if (orphanSessions) {
      const orphans = await countOrphanSessions();
      console.info(`Will delete: ${orphans} orphan sessions (users that no longer exist).`);
    }

    if (!execute) {
      console.info('Dry run — nothing changed. Re-run with --execute to apply.');
      return;
    }

    await resetUserData(user._id);
    const removedOrphans = orphanSessions ? await deleteOrphanSessions() : 0;
    const after = await countUserData(user._id);
    const reset = await UserModel.findById(user._id).lean();
    console.info(
      `Done. Remaining for user: ${after.categories} categories, ${after.transactions} transactions, ` +
        `${after.sessions} sessions; onboarded=${Boolean(reset?.onboardingCompletedAt)}, ` +
        `income=${reset?.finance.averageMonthlyIncomeMinor}, savings=${reset?.finance.monthlySavingsGoalMinor}.` +
        (orphanSessions ? ` Orphan sessions deleted: ${removedOrphans}.` : ''),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
