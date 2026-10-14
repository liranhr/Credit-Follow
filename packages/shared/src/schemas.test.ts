import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINANCIAL_CYCLE,
  completeOnboardingSchema,
  createExpenseCategorySchema,
  createExpenseTransactionSchema,
  facebookSignInSchema,
  financialCycleSchema,
  updateExpenseCategorySchema,
  updateExpenseTransactionSchema,
  updateFinanceSchema,
} from './index.js';

describe('financialCycleSchema', () => {
  it('accepts a salary-anchored cycle', () => {
    const value = { ...DEFAULT_FINANCIAL_CYCLE, anchor: 'salary', salaryDay: 10 };
    expect(financialCycleSchema.parse(value)).toEqual(value);
  });

  it.each([0, 32, 1.5])('rejects day %s', (day) => {
    for (const field of ['startDay', 'salaryDay', 'creditCardChargeDay']) {
      expect(
        financialCycleSchema.safeParse({ ...DEFAULT_FINANCIAL_CYCLE, [field]: day }).success,
      ).toBe(false);
    }
  });

  it('validates the time zone', () => {
    expect(
      financialCycleSchema.safeParse({ ...DEFAULT_FINANCIAL_CYCLE, timeZone: 'Europe/London' })
        .success,
    ).toBe(true);
    expect(
      financialCycleSchema.safeParse({ ...DEFAULT_FINANCIAL_CYCLE, timeZone: 'Mars/Olympus' })
        .success,
    ).toBe(false);
  });
});

describe('createExpenseCategorySchema', () => {
  it('trims Hebrew names and defaults the budget to 0', () => {
    expect(createExpenseCategorySchema.parse({ name: '  סופרמרקט ' })).toEqual({
      name: 'סופרמרקט',
      kind: 'variable',
      monthlyBudgetMinor: 0,
    });
  });

  it('accepts fixed expenses and rejects unknown kinds', () => {
    expect(
      createExpenseCategorySchema.parse({ name: 'שכר דירה', kind: 'fixed', monthlyBudgetMinor: 1 }),
    ).toMatchObject({ kind: 'fixed' });
    expect(createExpenseCategorySchema.safeParse({ name: 'x', kind: 'other' }).success).toBe(false);
  });

  it('rejects empty names, bad colors and negative budgets', () => {
    expect(createExpenseCategorySchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createExpenseCategorySchema.safeParse({ name: 'דלק', color: 'red' }).success).toBe(
      false,
    );
    expect(
      createExpenseCategorySchema.safeParse({ name: 'דלק', monthlyBudgetMinor: -1 }).success,
    ).toBe(false);
  });

  it('update schema does not inject defaults, ignores kind and rejects empty updates', () => {
    expect(updateExpenseCategorySchema.parse({ isArchived: true })).toEqual({ isArchived: true });
    expect(updateExpenseCategorySchema.parse({ isArchived: true, kind: 'fixed' })).toEqual({
      isArchived: true,
    });
    expect(updateExpenseCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe('createExpenseTransactionSchema', () => {
  const valid = {
    categoryId: '507f1f77bcf86cd799439011',
    amountMinor: 12_990,
    occurredOn: '2026-10-01',
  };

  it('applies the payment method default', () => {
    expect(createExpenseTransactionSchema.parse(valid).paymentMethod).toBe('credit_card');
  });

  it.each([0, -100, 10.5])('rejects amountMinor %s', (amountMinor) => {
    expect(createExpenseTransactionSchema.safeParse({ ...valid, amountMinor }).success).toBe(false);
  });

  it.each(['2026-02-30', '2026-13-01', '01/10/2026', ''])('rejects date %j', (occurredOn) => {
    expect(createExpenseTransactionSchema.safeParse({ ...valid, occurredOn }).success).toBe(false);
  });

  it('rejects an invalid category id', () => {
    expect(createExpenseTransactionSchema.safeParse({ ...valid, categoryId: 'abc' }).success).toBe(
      false,
    );
  });

  it('update schema keeps omitted fields undefined', () => {
    expect(updateExpenseTransactionSchema.parse({ amountMinor: 500 })).toEqual({
      amountMinor: 500,
    });
  });
});

describe('completeOnboardingSchema', () => {
  const valid = {
    averageMonthlyIncomeMinor: 1_500_000,
    fixedExpenses: [{ name: 'שכר דירה', monthlyBudgetMinor: 500_000 }],
    variableExpenses: [{ name: 'סופר', monthlyBudgetMinor: 250_000 }],
    monthlySavingsGoalMinor: 200_000,
  };

  it('accepts a valid submission', () => {
    expect(completeOnboardingSchema.safeParse(valid).success).toBe(true);
  });

  it('allows no fixed expenses', () => {
    expect(completeOnboardingSchema.safeParse({ ...valid, fixedExpenses: [] }).success).toBe(true);
  });

  it('rejects duplicate names within a list (case-insensitive)', () => {
    const result = completeOnboardingSchema.safeParse({
      ...valid,
      variableExpenses: [
        { name: 'Food', monthlyBudgetMinor: 100 },
        { name: 'food ', monthlyBudgetMinor: 200 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['variableExpenses', 1, 'name']);
  });

  it('rejects the same name as both a fixed expense and a variable budget', () => {
    const result = completeOnboardingSchema.safeParse({
      ...valid,
      variableExpenses: [{ name: 'שכר דירה', monthlyBudgetMinor: 100 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['variableExpenses', 0, 'name']);
  });

  it('allows over-allocation (warned in the app, not rejected)', () => {
    expect(
      completeOnboardingSchema.safeParse({
        ...valid,
        fixedExpenses: [{ name: 'משכנתא', monthlyBudgetMinor: 2_000_000 }],
      }).success,
    ).toBe(true);
  });

  it('requires at least one variable budget and a savings goal not above income', () => {
    expect(completeOnboardingSchema.safeParse({ ...valid, variableExpenses: [] }).success).toBe(
      false,
    );
    expect(
      completeOnboardingSchema.safeParse({ ...valid, monthlySavingsGoalMinor: 1_600_000 }).success,
    ).toBe(false);
  });
});

describe('updateFinanceSchema', () => {
  it('requires at least one field and checks savings <= income when both given', () => {
    expect(updateFinanceSchema.safeParse({}).success).toBe(false);
    expect(updateFinanceSchema.safeParse({ averageMonthlyIncomeMinor: 100 }).success).toBe(true);
    expect(
      updateFinanceSchema.safeParse({
        averageMonthlyIncomeMinor: 100,
        monthlySavingsGoalMinor: 101,
      }).success,
    ).toBe(false);
  });
});

describe('facebookSignInSchema', () => {
  it('accepts both token kinds', () => {
    expect(
      facebookSignInSchema.safeParse({ kind: 'access_token', accessToken: 'x'.repeat(40) }).success,
    ).toBe(true);
    expect(
      facebookSignInSchema.safeParse({
        kind: 'limited',
        authenticationToken: 'x'.repeat(40),
        nonce: 'nonce-123456',
      }).success,
    ).toBe(true);
    expect(
      facebookSignInSchema.safeParse({ kind: 'limited', authenticationToken: 'x' }).success,
    ).toBe(false);
  });
});
