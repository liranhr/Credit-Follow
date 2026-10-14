import { describe, expect, it } from 'vitest';
import {
  buildBudgetSummary,
  computeBudgetPlan,
  type BudgetCategoryInput,
  type BudgetInput,
} from './budget.js';

const fixed = (id: string, amount: number, extra: Partial<BudgetCategoryInput> = {}) =>
  ({
    id,
    name: id,
    kind: 'fixed',
    monthlyBudgetMinor: amount,
    isArchived: false,
    sortOrder: 0,
    ...extra,
  }) satisfies BudgetCategoryInput;
const variable = (id: string, budget: number, extra: Partial<BudgetCategoryInput> = {}) =>
  ({
    id,
    name: id,
    kind: 'variable',
    monthlyBudgetMinor: budget,
    isArchived: false,
    sortOrder: 0,
    ...extra,
  }) satisfies BudgetCategoryInput;

// Income ₪15,000; fixed ₪3,000 + ₪2,500 + ₪2,006 = ₪7,506; savings goal ₪800;
// variable budgets ₪2,500 + ₪1,000 + ₪1,200 + ₪800 = ₪5,500.
const base: BudgetInput = {
  averageMonthlyIncomeMinor: 1_500_000,
  monthlySavingsGoalMinor: 80_000,
  categories: [
    fixed('rent', 300_000, { sortOrder: 0 }),
    fixed('car-loan', 250_000, { sortOrder: 1 }),
    fixed('insurance', 200_600, { sortOrder: 2 }),
    variable('groceries', 250_000, { sortOrder: 3 }),
    variable('fuel', 100_000, { sortOrder: 4 }),
    variable('shopping', 120_000, { sortOrder: 5 }),
    variable('restaurants', 80_000, { sortOrder: 6 }),
  ],
  spentByCategory: {},
  daysRemaining: 20,
};
const summarize = (overrides: Partial<BudgetInput> = {}) =>
  buildBudgetSummary({ ...base, ...overrides });
const byId = (s: ReturnType<typeof buildBudgetSummary>) =>
  Object.fromEntries(s.categories.map((c) => [c.id, c]));

describe('monthly plan', () => {
  it('income minus fixed expenses', () => {
    const s = summarize();
    expect(s.fixedExpensesMinor).toBe(750_600);
    expect(s.incomeAfterFixedMinor).toBe(749_400); // 15,000 − 7,506 = 7,494
    expect(s.fixedExceedsIncome).toBe(false);
  });

  it('income minus fixed expenses and savings', () => {
    expect(summarize().availableForVariableMinor).toBe(669_400); // 7,494 − 800 = 6,694
  });

  it('variable budget allocation and unallocated money', () => {
    const s = summarize();
    expect(s.variableBudgetMinor).toBe(550_000);
    expect(s.unallocatedMinor).toBe(119_400); // 7,494 − 800 − 5,500 = 1,194
    expect(s.variableOverAllocatedMinor).toBe(0);
  });

  it('flags variable budgets that exceed what is available (without changing them)', () => {
    const s = summarize({
      categories: [...base.categories, variable('vacation', 150_000, { sortOrder: 7 })],
    });
    expect(s.variableBudgetMinor).toBe(700_000);
    expect(s.unallocatedMinor).toBe(-30_600);
    expect(s.variableOverAllocatedMinor).toBe(30_600);
    expect(byId(s).vacation?.budgetMinor).toBe(150_000);
  });

  it('flags fixed expenses that exceed income', () => {
    const s = summarize({
      categories: [fixed('mortgage', 1_600_000), variable('groceries', 100_000)],
    });
    expect(s.incomeAfterFixedMinor).toBe(-100_000);
    expect(s.fixedExceedsIncome).toBe(true);
    expect(s.fixedExpensesMinor).toBe(1_600_000);
  });

  it('computeBudgetPlan uses the same formulas', () => {
    expect(
      computeBudgetPlan({
        incomeMinor: 1_500_000,
        fixedMinor: 750_600,
        savingsMinor: 80_000,
        variableMinor: 550_000,
      }),
    ).toEqual({
      incomeAfterFixedMinor: 749_400,
      availableForVariableMinor: 669_400,
      unallocatedMinor: 119_400,
      fixedExceedsIncome: false,
      variableOverAllocatedMinor: 0,
    });
  });
});

describe('actual spending and remaining variable budget', () => {
  it('shows every variable budget in full before anything is spent', () => {
    const s = summarize();
    expect(s.remainingVariableBudgetMinor).toBe(550_000);
    expect(s.variableBudgetUsedPercent).toBe(0);
    for (const c of s.categories) {
      expect(c.remainingMinor).toBe(c.budgetMinor);
      expect(c.usedPercent).toBe(0);
    }
  });

  it('subtracts actual variable spending (₪5,500 − ₪1,200 = ₪4,300)', () => {
    const s = summarize({ spentByCategory: { groceries: 80_000, fuel: 40_000 } });
    expect(s.variableSpentMinor).toBe(120_000);
    expect(s.remainingVariableBudgetMinor).toBe(430_000);
    expect(s.variableBudgetUsedPercent).toBe(22);
    expect(byId(s).groceries).toMatchObject({
      spentMinor: 80_000,
      remainingMinor: 170_000,
      usedPercent: 32,
    });
    expect(byId(s).shopping).toMatchObject({ spentMinor: 0, remainingMinor: 120_000 });
    expect(s.dailyAllowanceMinor).toBe(21_500); // 430,000 / 20 days
    // Spending does not change the plan.
    expect(s.unallocatedMinor).toBe(119_400);
  });

  it('never double-counts transactions recorded against a fixed expense', () => {
    const s = summarize({ spentByCategory: { rent: 300_000, groceries: 50_000 } });
    expect(s.fixedRecordedMinor).toBe(300_000);
    expect(s.variableSpentMinor).toBe(50_000);
    expect(s.remainingVariableBudgetMinor).toBe(500_000);
    expect(s.incomeAfterFixedMinor).toBe(749_400); // rent deducted once, in the plan
    expect(s.fixedExpenses.find((f) => f.id === 'rent')).toMatchObject({
      amountMinor: 300_000,
      recordedMinor: 300_000,
    });
    expect(s.categories.map((c) => c.id)).not.toContain('rent');
  });

  it('counts each variable transaction exactly once', () => {
    const s = summarize({ spentByCategory: { groceries: 12_345, fuel: 99_999, shopping: 1 } });
    const sumSpent = s.categories.reduce((sum, c) => sum + c.spentMinor, 0);
    const sumRemaining = s.categories.reduce((sum, c) => sum + c.remainingMinor, 0);
    expect(sumSpent).toBe(s.variableSpentMinor);
    expect(sumRemaining).toBe(s.remainingVariableBudgetMinor);
  });

  it('reports overspending per category and in total (not clamped)', () => {
    const s = summarize({ spentByCategory: { fuel: 130_000 } });
    expect(byId(s).fuel).toMatchObject({
      remainingMinor: -30_000,
      usedPercent: 130,
      status: 'over',
    });
    const all = summarize({
      categories: [variable('groceries', 100_000)],
      spentByCategory: { groceries: 125_000 },
    });
    expect(all.remainingVariableBudgetMinor).toBe(-25_000);
    expect(all.overspentMinor).toBe(25_000);
    expect(all.dailyAllowanceMinor).toBe(0);
  });

  it('flags category statuses', () => {
    const s = summarize({
      categories: [
        variable('ok', 100_000),
        variable('warning', 100_000),
        variable('over', 100_000),
        variable('none', 0),
      ],
      spentByCategory: { ok: 10_000, warning: 80_000, over: 100_001, none: 500 },
    });
    expect(byId(s).ok?.status).toBe('ok');
    expect(byId(s).warning?.status).toBe('warning');
    expect(byId(s).over?.status).toBe('over');
    expect(byId(s).none).toMatchObject({ status: 'unbudgeted', usedPercent: null });
  });

  it('projects savings assuming the variable budget is used up', () => {
    expect(summarize().projectedSavingsMinor).toBe(199_400); // 749,400 − 550,000
    expect(summarize().savingsOnTrack).toBe(true);
    const over = summarize({ spentByCategory: { groceries: 700_000 } });
    expect(over.projectedSavingsMinor).toBe(49_400); // 749,400 − 700,000
    expect(over.savingsOnTrack).toBe(false);
  });
});

describe('archived items and unknown categories', () => {
  it('excludes archived fixed expenses from the plan but lists recorded ones', () => {
    const s = summarize({
      categories: [
        ...base.categories,
        fixed('old-gym', 20_000, { isArchived: true }),
        fixed('old-phone', 9_000, { isArchived: true }),
      ],
      spentByCategory: { 'old-gym': 20_000 },
    });
    expect(s.fixedExpensesMinor).toBe(750_600);
    expect(s.fixedExpenses.map((f) => f.id)).toContain('old-gym');
    expect(s.fixedExpenses.map((f) => f.id)).not.toContain('old-phone');
    expect(s.fixedExpenses.find((f) => f.id === 'old-gym')).toMatchObject({ amountMinor: 0 });
    expect(s.variableSpentMinor).toBe(0);
  });

  it('keeps spending in archived variable categories in the totals without a budget', () => {
    const s = summarize({
      categories: [...base.categories, variable('old', 50_000, { isArchived: true })],
      spentByCategory: { old: 5_000 },
    });
    expect(s.variableBudgetMinor).toBe(550_000);
    expect(s.variableSpentMinor).toBe(5_000);
    expect(byId(s).old).toMatchObject({ budgetMinor: 0, spentMinor: 5_000, isArchived: true });
  });

  it('counts spending in unknown categories as variable spending', () => {
    expect(summarize({ spentByCategory: { ghost: 1_000 } }).variableSpentMinor).toBe(1_000);
  });
});
