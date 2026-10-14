import { completeOnboardingSchema, type CategoryKind } from '@credit-follow/shared';
import { Router } from 'express';
import type { ApiDeps } from '../deps.js';
import { HttpError } from '../errors/HttpError.js';
import { getValidated, validate } from '../middleware/validate.js';
import { CATEGORY_NAME_COLLATION, ExpenseCategoryModel } from '../models/expenseCategory.model.js';
import { toUserDto } from '../services/serializers.js';
import { loadUser } from './loadUser.js';

export function createOnboardingRouter(deps: ApiDeps): Router {
  const router = Router();
  const schemas = { body: completeOnboardingSchema };

  /**
   * Saves income, fixed monthly expenses, variable spending budgets and the savings goal.
   * Fixed expenses come first in the sort order, then the variable budgets.
   */
  router.post('/', validate(schemas), async (_req, res) => {
    const user = await loadUser(res);
    if (user.onboardingCompletedAt) {
      throw new HttpError(409, 'ONBOARDING_COMPLETED', 'תהליך ההרשמה כבר הושלם');
    }
    const input = getValidated(res, schemas).body;

    const items: { kind: CategoryKind; name: string; monthlyBudgetMinor: number }[] = [
      ...input.fixedExpenses.map((e) => ({ kind: 'fixed' as const, ...e })),
      ...input.variableExpenses.map((e) => ({ kind: 'variable' as const, ...e })),
    ];

    // Upsert by name (case-insensitive) so retrying after a network error is safe.
    for (const [index, item] of items.entries()) {
      const existing = await ExpenseCategoryModel.findOne({
        userId: user._id,
        name: item.name,
      })
        .collation(CATEGORY_NAME_COLLATION)
        .lean();
      if (existing) {
        // Update in place (never delete) so any transactions keep their category.
        // Written via the driver because `kind` is immutable through Mongoose documents.
        await ExpenseCategoryModel.collection.updateOne(
          { _id: existing._id, userId: user._id },
          {
            $set: {
              kind: item.kind,
              monthlyBudgetMinor: item.monthlyBudgetMinor,
              isArchived: false,
              sortOrder: index,
              updatedAt: deps.now(),
            },
          },
        );
        continue;
      }
      await ExpenseCategoryModel.create({
        userId: user._id,
        name: item.name,
        kind: item.kind,
        monthlyBudgetMinor: item.monthlyBudgetMinor,
        sortOrder: index,
      });
    }

    user.finance.averageMonthlyIncomeMinor = input.averageMonthlyIncomeMinor;
    user.finance.monthlySavingsGoalMinor = input.monthlySavingsGoalMinor;
    user.onboardingCompletedAt = deps.now();
    await user.save();

    res.status(201).json(toUserDto(user));
  });

  return router;
}
