import {
  SAVINGS_ABOVE_INCOME_MESSAGE,
  updateFinanceSchema,
  updateFinancialCycleSchema,
} from '@credit-follow/shared';
import { Router } from 'express';
import type { ApiDeps } from '../deps.js';
import { HttpError } from '../errors/HttpError.js';
import { getValidated, validate } from '../middleware/validate.js';
import { ExpenseCategoryModel } from '../models/expenseCategory.model.js';
import { ExpenseTransactionModel } from '../models/expenseTransaction.model.js';
import { UserModel } from '../models/user.model.js';
import { toUserDto } from '../services/serializers.js';
import { loadUser } from './loadUser.js';

export function createMeRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(toUserDto(await loadUser(res)));
  });

  const financeSchemas = { body: updateFinanceSchema };
  router.put('/finance', validate(financeSchemas), async (_req, res) => {
    const user = await loadUser(res);
    const input = getValidated(res, financeSchemas).body;
    const income = input.averageMonthlyIncomeMinor ?? user.finance.averageMonthlyIncomeMinor;
    const savings = input.monthlySavingsGoalMinor ?? user.finance.monthlySavingsGoalMinor;
    if (savings > income) {
      throw HttpError.badRequest(SAVINGS_ABOVE_INCOME_MESSAGE, [
        {
          location: 'body',
          path: 'monthlySavingsGoalMinor',
          message: SAVINGS_ABOVE_INCOME_MESSAGE,
        },
      ]);
    }
    user.finance.averageMonthlyIncomeMinor = income;
    user.finance.monthlySavingsGoalMinor = savings;
    await user.save();
    res.json(toUserDto(user));
  });

  const cycleSchemas = { body: updateFinancialCycleSchema };
  router.put('/financial-cycle', validate(cycleSchemas), async (_req, res) => {
    const user = await loadUser(res);
    user.preferences.financialCycle = getValidated(res, cycleSchemas).body;
    await user.save();
    res.json(toUserDto(user));
  });

  /** Deletes the account and all of its data (also used for Facebook data deletion requests). */
  router.delete('/', async (_req, res) => {
    const user = await loadUser(res);
    await deps.sessions.revokeAllForUser(user._id, 'account_deleted');
    await ExpenseTransactionModel.deleteMany({ userId: user._id });
    await ExpenseCategoryModel.deleteMany({ userId: user._id });
    await UserModel.deleteOne({ _id: user._id });
    res.status(204).end();
  });

  return router;
}
