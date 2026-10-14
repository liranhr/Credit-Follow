import {
  getTransactionStatus,
  toLocalDate,
  formatLocalDate,
  type ExpenseCategoryDto,
  type ExpenseTransactionDto,
  type FinancialCycleSettings,
  type UserDto,
} from '@credit-follow/shared';
import type { ExpenseCategoryDocument } from '../models/expenseCategory.model.js';
import type { ExpenseTransactionDocument } from '../models/expenseTransaction.model.js';
import type { UserDocument } from '../models/user.model.js';

export function toUserDto(user: UserDocument): UserDto {
  const c = user.preferences.financialCycle;
  return {
    id: user._id.toString(),
    ...(user.email && { email: user.email }),
    displayName: user.displayName,
    ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
    providers: user.authIdentities.map((identity) => identity.provider),
    preferences: {
      locale: user.preferences.locale,
      currency: user.preferences.currency,
      financialCycle: {
        anchor: c.anchor,
        startDay: c.startDay,
        salaryDay: c.salaryDay,
        creditCardChargeDay: c.creditCardChargeDay,
        timeZone: c.timeZone,
      },
    },
    finance: {
      averageMonthlyIncomeMinor: user.finance.averageMonthlyIncomeMinor,
      monthlySavingsGoalMinor: user.finance.monthlySavingsGoalMinor,
    },
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toCategoryDto(category: ExpenseCategoryDocument): ExpenseCategoryDto {
  return {
    id: category._id.toString(),
    name: category.name,
    kind: category.kind ?? 'variable',
    monthlyBudgetMinor: category.monthlyBudgetMinor,
    ...(category.color && { color: category.color }),
    ...(category.icon && { icon: category.icon }),
    sortOrder: category.sortOrder,
    isArchived: category.isArchived,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toTransactionDto(
  tx: ExpenseTransactionDocument,
  settings: FinancialCycleSettings,
  now: Date,
): ExpenseTransactionDto {
  const occurredOn = toLocalDate(tx.occurredAt, settings.timeZone);
  const { status, chargeOn } = getTransactionStatus(
    { paymentMethod: tx.paymentMethod, occurredOn },
    settings,
    now,
  );
  return {
    id: tx._id.toString(),
    categoryId: tx.categoryId.toString(),
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    occurredOn: formatLocalDate(occurredOn),
    ...(tx.description && { description: tx.description }),
    paymentMethod: tx.paymentMethod,
    status,
    chargeOn,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}
