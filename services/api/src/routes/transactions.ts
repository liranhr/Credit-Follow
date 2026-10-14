import {
  createExpenseTransactionSchema,
  getFinancialCycle,
  listTransactionsQuerySchema,
  updateExpenseTransactionSchema,
} from '@credit-follow/shared';
import { Router } from 'express';
import type { Types } from 'mongoose';
import type { ApiDeps } from '../deps.js';
import { HttpError } from '../errors/HttpError.js';
import { getValidated, validate } from '../middleware/validate.js';
import { ExpenseCategoryModel } from '../models/expenseCategory.model.js';
import { ExpenseTransactionModel } from '../models/expenseTransaction.model.js';
import {
  findTransactionsInCycle,
  getCycleSettings,
  occurredOnToInstant,
} from '../services/finance.service.js';
import { toTransactionDto } from '../services/serializers.js';
import { idParamsSchema } from './categories.js';
import { loadUser } from './loadUser.js';

const CATEGORY_NOT_FOUND = 'הקטגוריה לא נמצאה או שהועברה לארכיון';

/** The category must belong to the authenticated user and be active. */
async function assertActiveCategory(userId: Types.ObjectId, categoryId: string): Promise<void> {
  const exists = await ExpenseCategoryModel.exists({ _id: categoryId, userId, isArchived: false });
  if (!exists) {
    throw HttpError.badRequest(CATEGORY_NOT_FOUND, [
      { location: 'body', path: 'categoryId', message: CATEGORY_NOT_FOUND },
    ]);
  }
}

export function createTransactionsRouter(deps: ApiDeps): Router {
  const router = Router();

  const listSchemas = { query: listTransactionsQuerySchema };
  router.get('/', validate(listSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { cycleOffset, categoryId } = getValidated(res, listSchemas).query;
    const now = deps.now();
    const settings = getCycleSettings(user);
    const cycle = getFinancialCycle(settings, now, cycleOffset);
    const transactions = await findTransactionsInCycle(user._id, cycle, categoryId);
    res.json({
      cycle,
      totalMinor: transactions.reduce((sum, tx) => sum + tx.amountMinor, 0),
      transactions: transactions.map((tx) => toTransactionDto(tx, settings, now)),
    });
  });

  const createSchemas = { body: createExpenseTransactionSchema };
  router.post('/', validate(createSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { occurredOn, ...input } = getValidated(res, createSchemas).body;
    await assertActiveCategory(user._id, input.categoryId);
    const settings = getCycleSettings(user);
    const tx = await ExpenseTransactionModel.create({
      ...input,
      userId: user._id,
      currency: user.preferences.currency,
      occurredAt: occurredOnToInstant(occurredOn, settings.timeZone),
    });
    res.status(201).json(toTransactionDto(tx, settings, deps.now()));
  });

  const idSchemas = { params: idParamsSchema };
  router.get('/:id', validate(idSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { id } = getValidated(res, idSchemas).params;
    const tx = await ExpenseTransactionModel.findOne({ _id: id, userId: user._id });
    if (!tx) throw HttpError.notFound('ההוצאה לא נמצאה');
    res.json(toTransactionDto(tx, getCycleSettings(user), deps.now()));
  });

  const updateSchemas = { params: idParamsSchema, body: updateExpenseTransactionSchema };
  router.patch('/:id', validate(updateSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { params, body } = getValidated(res, updateSchemas);
    const tx = await ExpenseTransactionModel.findOne({ _id: params.id, userId: user._id });
    if (!tx) throw HttpError.notFound('ההוצאה לא נמצאה');

    const settings = getCycleSettings(user);
    const { occurredOn, categoryId, description, ...rest } = body;
    if (categoryId !== undefined && categoryId !== tx.categoryId.toString()) {
      await assertActiveCategory(user._id, categoryId);
      tx.set('categoryId', categoryId);
    }
    if (occurredOn !== undefined) {
      tx.occurredAt = occurredOnToInstant(occurredOn, settings.timeZone);
    }
    if (description !== undefined) {
      // An empty description clears it.
      tx.set('description', description === '' ? undefined : description);
    }
    tx.set(rest);
    await tx.save();
    res.json(toTransactionDto(tx, settings, deps.now()));
  });

  router.delete('/:id', validate(idSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const { id } = getValidated(res, idSchemas).params;
    const result = await ExpenseTransactionModel.deleteOne({ _id: id, userId: user._id });
    if (result.deletedCount === 0) throw HttpError.notFound('ההוצאה לא נמצאה');
    res.status(204).end();
  });

  return router;
}
