import { z } from 'zod';
import { MAX_ONBOARDING_EXPENSES } from '../constants.js';
import { amountMinorSchema, nonNegativeAmountMinorSchema } from './common.js';
import { categoryNameSchema } from './expenseCategory.js';
import { SAVINGS_ABOVE_INCOME_MESSAGE } from './user.js';

export const onboardingExpenseSchema = z.object({
  name: categoryNameSchema,
  monthlyBudgetMinor: amountMinorSchema,
});

export type OnboardingExpense = z.infer<typeof onboardingExpenseSchema>;

const DUPLICATE_NAME = 'השם כבר קיים ברשימה (כולל הוצאות קבועות ותקציבים משתנים)';

/**
 * POST /onboarding — submitted once, by the "לסיום" button.
 * - fixedExpenses: fixed monthly expenses (rent, loan…), may be empty.
 * - variableExpenses: variable spending budgets (groceries, fuel…), at least one.
 * A name may appear only once across both lists, so nothing is counted twice.
 * Over-allocation (fixed > income, variable > available) is allowed — the app warns.
 */
export const completeOnboardingSchema = z
  .object({
    averageMonthlyIncomeMinor: amountMinorSchema,
    fixedExpenses: z
      .array(onboardingExpenseSchema)
      .max(MAX_ONBOARDING_EXPENSES, `ניתן להזין עד ${MAX_ONBOARDING_EXPENSES} הוצאות קבועות`),
    variableExpenses: z
      .array(onboardingExpenseSchema)
      .min(1, 'יש להזין לפחות תקציב הוצאה משתנה אחד')
      .max(MAX_ONBOARDING_EXPENSES, `ניתן להזין עד ${MAX_ONBOARDING_EXPENSES} תקציבים`),
    monthlySavingsGoalMinor: nonNegativeAmountMinorSchema,
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const list of ['fixedExpenses', 'variableExpenses'] as const) {
      value[list].forEach((expense, index) => {
        const key = expense.name.toLocaleLowerCase('he');
        if (seen.has(key)) {
          ctx.addIssue({ code: 'custom', message: DUPLICATE_NAME, path: [list, index, 'name'] });
        }
        seen.add(key);
      });
    }
    if (value.monthlySavingsGoalMinor > value.averageMonthlyIncomeMinor) {
      ctx.addIssue({
        code: 'custom',
        message: SAVINGS_ABOVE_INCOME_MESSAGE,
        path: ['monthlySavingsGoalMinor'],
      });
    }
  });

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
