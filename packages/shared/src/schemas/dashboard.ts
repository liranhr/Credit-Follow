import type { BudgetSummary } from '../finance/budget.js';
import type { FinancialCycleInfo } from '../finance/cycle.js';
import type { ExpenseTransactionDto } from './expenseTransaction.js';

export interface DashboardDto {
  cycle: FinancialCycleInfo;
  summary: BudgetSummary;
  /** Credit card purchases in the cycle that have not been deducted yet. */
  pendingChargesMinor: number;
  /** Next credit card deduction date (YYYY-MM-DD). */
  nextCreditCardChargeOn: string;
  recentTransactions: ExpenseTransactionDto[];
}
