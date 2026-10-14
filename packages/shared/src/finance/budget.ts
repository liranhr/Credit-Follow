import { BUDGET_WARNING_RATIO, type CategoryKind } from '../constants.js';

export type CategoryBudgetStatus = 'ok' | 'warning' | 'over' | 'unbudgeted';

export interface BudgetCategoryInput {
  id: string;
  name: string;
  color?: string;
  kind: CategoryKind;
  /** Variable: planned monthly budget. Fixed: the fixed monthly amount. */
  monthlyBudgetMinor: number;
  isArchived: boolean;
  sortOrder: number;
}

export interface BudgetInput {
  averageMonthlyIncomeMinor: number;
  monthlySavingsGoalMinor: number;
  categories: BudgetCategoryInput[];
  /** Total recorded in the cycle per category id (fixed and variable). */
  spentByCategory: Record<string, number>;
  /** Days remaining in the cycle including today (used for the daily allowance). */
  daysRemaining: number;
}

/** A variable spending budget and its actual spending in the cycle. */
export interface CategoryBudgetSummary {
  id: string;
  name: string;
  color?: string;
  isArchived: boolean;
  budgetMinor: number;
  spentMinor: number;
  /** budget − spent; negative when over budget (never clamped). */
  remainingMinor: number;
  /** spent / budget (e.g. 0.5 = 50%), null when the category has no budget. */
  usedRatio: number | null;
  /** spent / budget × 100, rounded to a whole percent; null when the category has no budget. */
  usedPercent: number | null;
  status: CategoryBudgetStatus;
}

/** A fixed monthly expense. */
export interface FixedExpenseSummary {
  id: string;
  name: string;
  isArchived: boolean;
  /** Fixed monthly amount (0 for archived items, which no longer count). */
  amountMinor: number;
  /** Transactions recorded against it in the cycle — informational, never deducted again. */
  recordedMinor: number;
}

export interface BudgetSummary {
  /** Average monthly income. */
  incomeMinor: number;
  /** Σ active fixed monthly expenses. */
  fixedExpensesMinor: number;
  /** income − fixed expenses. */
  incomeAfterFixedMinor: number;
  /** True when fixed expenses exceed income (incomeAfterFixed < 0). */
  fixedExceedsIncome: boolean;
  savingsGoalMinor: number;
  /** income after fixed expenses − savings goal: what variable budgets can be allocated from. */
  availableForVariableMinor: number;
  /** Σ active variable budgets. */
  variableBudgetMinor: number;
  /** Σ transactions in variable categories in the cycle (archived variable categories included). */
  variableSpentMinor: number;
  /**
   * variable budget − actual variable spending: the dashboard's "נותר להוציא".
   * Negative when variable spending exceeds the budget (never clamped).
   */
  remainingVariableBudgetMinor: number;
  /** max(0, variable spent − variable budget). */
  overspentMinor: number;
  /** variable spent / variable budget × 100 (whole percent); null when no variable budget. */
  variableBudgetUsedPercent: number | null;
  /** income after fixed − savings goal − variable budget (negative = over-allocated). */
  unallocatedMinor: number;
  /** max(0, variable budget − available for variable): planned variable spending beyond what is available. */
  variableOverAllocatedMinor: number;
  /** Σ transactions recorded against fixed expenses in the cycle (not deducted again). */
  fixedRecordedMinor: number;
  /** income after fixed − max(variable budget, variable spent): savings if the variable budget is used up. */
  projectedSavingsMinor: number;
  savingsOnTrack: boolean;
  /** max(0, remaining variable budget) / days remaining, rounded down. */
  dailyAllowanceMinor: number;
  /** Variable budgets (active, plus archived ones that have spending in the cycle). */
  categories: CategoryBudgetSummary[];
  /** Fixed expenses (active, plus archived ones with recorded transactions in the cycle). */
  fixedExpenses: FixedExpenseSummary[];
}

export interface BudgetPlanInput {
  incomeMinor: number;
  fixedMinor: number;
  savingsMinor: number;
  variableMinor: number;
}

/**
 * The monthly plan formulas, shared by onboarding (live preview) and the dashboard:
 *   income after fixed     = income − fixed expenses
 *   available for variable = income after fixed − savings goal
 *   unallocated            = available for variable − variable budget
 */
export function computeBudgetPlan(input: BudgetPlanInput) {
  const incomeAfterFixedMinor = input.incomeMinor - input.fixedMinor;
  const availableForVariableMinor = incomeAfterFixedMinor - input.savingsMinor;
  const unallocatedMinor = availableForVariableMinor - input.variableMinor;
  return {
    incomeAfterFixedMinor,
    availableForVariableMinor,
    unallocatedMinor,
    fixedExceedsIncome: incomeAfterFixedMinor < 0,
    variableOverAllocatedMinor: Math.max(0, -unallocatedMinor),
  };
}

/** Whole-number percentage of `part` in `whole`; null when `whole` is not positive. */
function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function categoryStatus(budget: number, spent: number): CategoryBudgetStatus {
  if (budget <= 0) return spent > 0 ? 'unbudgeted' : 'ok';
  if (spent > budget) return 'over';
  if (spent >= budget * BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

const byDisplayOrder = (a: BudgetCategoryInput, b: BudgetCategoryInput) =>
  Number(a.isArchived) - Number(b.isArchived) ||
  a.sortOrder - b.sortOrder ||
  a.name.localeCompare(b.name, 'he');

/**
 * Builds the monthly budget plan and the cycle's actual spending.
 *
 *   fixed expenses           = Σ active fixed monthly amounts
 *   income after fixed       = income − fixed expenses
 *   available for variable   = income after fixed − savings goal
 *   variable budget          = Σ active variable budgets
 *   unallocated              = income after fixed − savings goal − variable budget
 *   actual variable spending = Σ transactions in variable categories (current cycle)
 *   remaining variable       = variable budget − actual variable spending
 *
 * Fixed expenses are deducted once, in the plan. Transactions recorded against a fixed
 * expense are reported separately (`fixedRecordedMinor`) and never reduce the variable
 * budget, so nothing is counted twice. Transactions in unknown categories count as
 * variable spending so that recorded money is never dropped. All amounts are integer
 * minor units, so the arithmetic is exact.
 */
export function buildBudgetSummary(input: BudgetInput): BudgetSummary {
  const incomeMinor = input.averageMonthlyIncomeMinor;
  const savingsGoalMinor = input.monthlySavingsGoalMinor;
  const kindById = new Map(input.categories.map((c) => [c.id, c.kind]));
  const sorted = [...input.categories].sort(byDisplayOrder);

  const categories: CategoryBudgetSummary[] = [];
  const fixedExpenses: FixedExpenseSummary[] = [];
  let fixedExpensesMinor = 0;
  let variableBudgetMinor = 0;

  for (const category of sorted) {
    const spentMinor = input.spentByCategory[category.id] ?? 0;
    if (category.isArchived && spentMinor === 0) continue;
    const amountMinor = category.isArchived ? 0 : category.monthlyBudgetMinor;

    if (category.kind === 'fixed') {
      fixedExpensesMinor += amountMinor;
      fixedExpenses.push({
        id: category.id,
        name: category.name,
        isArchived: category.isArchived,
        amountMinor,
        recordedMinor: spentMinor,
      });
      continue;
    }

    variableBudgetMinor += amountMinor;
    categories.push({
      id: category.id,
      name: category.name,
      ...(category.color !== undefined && { color: category.color }),
      isArchived: category.isArchived,
      budgetMinor: amountMinor,
      spentMinor,
      remainingMinor: amountMinor - spentMinor,
      usedRatio: amountMinor > 0 ? spentMinor / amountMinor : null,
      usedPercent: percent(spentMinor, amountMinor),
      status: categoryStatus(amountMinor, spentMinor),
    });
  }

  let variableSpentMinor = 0;
  let fixedRecordedMinor = 0;
  for (const [categoryId, amount] of Object.entries(input.spentByCategory)) {
    if (kindById.get(categoryId) === 'fixed') fixedRecordedMinor += amount;
    else variableSpentMinor += amount;
  }

  const plan = computeBudgetPlan({
    incomeMinor,
    fixedMinor: fixedExpensesMinor,
    savingsMinor: savingsGoalMinor,
    variableMinor: variableBudgetMinor,
  });
  const { incomeAfterFixedMinor } = plan;
  const remainingVariableBudgetMinor = variableBudgetMinor - variableSpentMinor;
  const projectedSavingsMinor =
    incomeAfterFixedMinor - Math.max(variableBudgetMinor, variableSpentMinor);

  return {
    incomeMinor,
    fixedExpensesMinor,
    incomeAfterFixedMinor,
    fixedExceedsIncome: plan.fixedExceedsIncome,
    savingsGoalMinor,
    availableForVariableMinor: plan.availableForVariableMinor,
    variableBudgetMinor,
    variableSpentMinor,
    remainingVariableBudgetMinor,
    overspentMinor: Math.max(0, -remainingVariableBudgetMinor),
    variableBudgetUsedPercent: percent(variableSpentMinor, variableBudgetMinor),
    unallocatedMinor: plan.unallocatedMinor,
    variableOverAllocatedMinor: plan.variableOverAllocatedMinor,
    fixedRecordedMinor,
    projectedSavingsMinor,
    savingsOnTrack: projectedSavingsMinor >= savingsGoalMinor,
    dailyAllowanceMinor:
      input.daysRemaining > 0
        ? Math.floor(Math.max(0, remainingVariableBudgetMinor) / input.daysRemaining)
        : 0,
    categories,
    fixedExpenses,
  };
}
