/**
 * One-off, idempotent migration: categories created before fixed expenses existed have no
 * `kind`; mark them as variable spending budgets. Nothing is deleted.
 *
 *   npm run migrate:category-kind -w @credit-follow/api              (dry run)
 *   npm run migrate:category-kind -w @credit-follow/api -- --execute
 *
 * The API already treats a missing `kind` as variable, so running this is optional; it just
 * makes the stored data explicit.
 */
import mongoose from 'mongoose';
import { loadEnvFromProcess } from '../config/env.js';
import { ExpenseCategoryModel } from '../models/index.js';

async function main(): Promise<void> {
  const env = loadEnvFromProcess();
  await mongoose.connect(env.MONGODB_URI);
  try {
    const filter = { kind: { $exists: false } };
    const pending = await ExpenseCategoryModel.collection.countDocuments(filter);
    console.info(`Categories without kind: ${pending}`);
    if (!process.argv.includes('--execute')) {
      console.info('Dry run — nothing changed. Re-run with --execute to apply.');
      return;
    }
    const result = await ExpenseCategoryModel.collection.updateMany(filter, {
      $set: { kind: 'variable' },
    });
    console.info(`Updated ${result.modifiedCount} categories to kind=variable.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
