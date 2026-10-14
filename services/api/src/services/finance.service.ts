import {
  buildBudgetSummary,
  formatLocalDate,
  getFinancialCycle,
  getNextCreditCardChargeDate,
  getTransactionStatus,
  parseLocalDate,
  toLocalDate,
  zonedTimeToUtc,
  type DashboardDto,
  type FinancialCycleInfo,
  type FinancialCycleSettings,
} from '@credit-follow/shared';
import type { Types } from 'mongoose';
import { HttpError } from '../errors/HttpError.js';
import { ExpenseCategoryModel } from '../models/expenseCategory.model.js';
import {
  ExpenseTransactionModel,
  type ExpenseTransactionDocument,
} from '../models/expenseTransaction.model.js';
import type { UserDocument } from '../models/user.model.js';
import { toTransactionDto } from './serializers.js';

const RECENT_TRANSACTIONS_LIMIT = 10;
/** Card purchases older than this are always already charged (charge day ≤ ~1 month later). */
const PENDING_LOOKBACK_DAYS = 62;

export function getCycleSettings(user: UserDocument): FinancialCycleSettings {
  const c = user.preferences.financialCycle;
  return {
    anchor: c.anchor,
    startDay: c.startDay,
    salaryDay: c.salaryDay,
    creditCardChargeDay: c.creditCardChargeDay,
    timeZone: c.timeZone,
  };
}

/** Purchases are stored at 12:00 local time on their day (robust to small TZ changes). */
export function occurredOnToInstant(occurredOn: string, timeZone: string): Date {
  const date = parseLocalDate(occurredOn);
  if (!date) throw HttpError.badRequest('תאריך לא תקין');
  return zonedTimeToUtc(date, timeZone, 12, 0);
}

export function instantToOccurredOn(instant: Date, timeZone: string): string {
  return formatLocalDate(toLocalDate(instant, timeZone));
}

export async function getSpentByCategory(
  userId: Types.ObjectId,
  cycle: FinancialCycleInfo,
): Promise<Record<string, number>> {
  const rows = await ExpenseTransactionModel.aggregate<{ _id: Types.ObjectId; total: number }>([
    {
      $match: {
        userId,
        occurredAt: { $gte: new Date(cycle.startsAt), $lt: new Date(cycle.endsAt) },
      },
    },
    { $group: { _id: '$categoryId', total: { $sum: '$amountMinor' } } },
  ]);
  return Object.fromEntries(rows.map((row) => [row._id.toString(), row.total]));
}

export function findTransactionsInCycle(
  userId: Types.ObjectId,
  cycle: FinancialCycleInfo,
  categoryId?: string,
) {
  return ExpenseTransactionModel.find({
    userId,
    occurredAt: { $gte: new Date(cycle.startsAt), $lt: new Date(cycle.endsAt) },
    ...(categoryId && { categoryId }),
  }).sort({ occurredAt: -1, createdAt: -1 });
}

async function getPendingChargesMinor(
  userId: Types.ObjectId,
  settings: FinancialCycleSettings,
  now: Date,
): Promise<number> {
  const candidates: ExpenseTransactionDocument[] = await ExpenseTransactionModel.find({
    userId,
    paymentMethod: 'credit_card',
    occurredAt: { $gte: new Date(now.getTime() - PENDING_LOOKBACK_DAYS * 86_400_000) },
  });
  return candidates.reduce((sum, tx) => {
    const occurredOn = toLocalDate(tx.occurredAt, settings.timeZone);
    const { status } = getTransactionStatus(
      { paymentMethod: tx.paymentMethod, occurredOn },
      settings,
      now,
    );
    return status === 'pending' ? sum + tx.amountMinor : sum;
  }, 0);
}

export async function buildDashboard(
  user: UserDocument,
  now: Date,
  cycleOffset = 0,
): Promise<DashboardDto> {
  const settings = getCycleSettings(user);
  const cycle = getFinancialCycle(settings, now, cycleOffset);

  const [categories, spentByCategory, recent, pendingChargesMinor] = await Promise.all([
    ExpenseCategoryModel.find({ userId: user._id }).lean(),
    getSpentByCategory(user._id, cycle),
    findTransactionsInCycle(user._id, cycle).limit(RECENT_TRANSACTIONS_LIMIT),
    getPendingChargesMinor(user._id, settings, now),
  ]);

  const summary = buildBudgetSummary({
    averageMonthlyIncomeMinor: user.finance.averageMonthlyIncomeMinor,
    monthlySavingsGoalMinor: user.finance.monthlySavingsGoalMinor,
    categories: categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      ...(c.color && { color: c.color }),
      kind: c.kind ?? 'variable',
      monthlyBudgetMinor: c.monthlyBudgetMinor,
      isArchived: c.isArchived,
      sortOrder: c.sortOrder,
    })),
    spentByCategory,
    daysRemaining: cycle.daysRemaining,
  });

  return {
    cycle,
    summary,
    pendingChargesMinor,
    nextCreditCardChargeOn: getNextCreditCardChargeDate(settings, now),
    recentTransactions: recent.map((tx) => toTransactionDto(tx, settings, now)),
  };
}
