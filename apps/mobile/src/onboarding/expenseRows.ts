import { parseMoneyToMinor, type OnboardingExpense } from '@credit-follow/shared';
import { he } from '@/i18n/he';
import type { ExpenseRowDraft } from './OnboardingContext';

export interface RowErrors {
  name?: string;
  amount?: string;
}

export const isEmptyRow = (row: ExpenseRowDraft) => !row.name.trim() && !row.amount.trim();
export const hasRowErrors = (e: RowErrors) => Boolean(e.name || e.amount);
const normalize = (name: string) => name.trim().toLocaleLowerCase('he');

/**
 * Validates one row: a name, a positive amount, and a name that is unique within its list
 * and not used in the other list (fixed vs. variable), so nothing is counted twice.
 */
export function validateRow(
  row: ExpenseRowDraft,
  rows: ExpenseRowDraft[],
  otherListNames: string[],
): RowErrors {
  const errors: RowErrors = {};
  const name = normalize(row.name);
  if (!name) errors.name = he.errors.nameRequired;
  else if (
    rows.some((other) => other.key !== row.key && normalize(other.name) === name) ||
    otherListNames.some((other) => normalize(other) === name)
  ) {
    errors.name = he.errors.nameDuplicate;
  }
  const amount = parseMoneyToMinor(row.amount);
  if (amount === null) errors.amount = he.errors.amountInvalid;
  else if (amount <= 0) errors.amount = he.errors.amountRequired;
  return errors;
}

/** Validates every non-empty row. Returns errors keyed by row key (empty object = valid). */
export function validateFilledRows(rows: ExpenseRowDraft[], otherListNames: string[]) {
  const filled = rows.filter((row) => !isEmptyRow(row));
  const errors: Record<string, RowErrors> = {};
  for (const row of filled) {
    const rowErrors = validateRow(row, filled, otherListNames);
    if (hasRowErrors(rowErrors)) errors[row.key] = rowErrors;
  }
  return { filled, errors };
}

/** Rows with a name and a valid positive amount, as API payload. */
export function rowsToPayload(rows: ExpenseRowDraft[]): OnboardingExpense[] {
  return rows.flatMap((row) => {
    const name = row.name.trim();
    const amount = parseMoneyToMinor(row.amount);
    return name && amount && amount > 0 ? [{ name, monthlyBudgetMinor: amount }] : [];
  });
}

/** Sum of the valid amounts (minor units). */
export function sumRows(rows: ExpenseRowDraft[]): number {
  return rows.reduce((sum, row) => {
    const amount = parseMoneyToMinor(row.amount);
    return amount && amount > 0 ? sum + amount : sum;
  }, 0);
}

export const rowNames = (rows: ExpenseRowDraft[]) =>
  rows.map((row) => row.name).filter((name) => name.trim());
