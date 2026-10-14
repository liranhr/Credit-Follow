import { MAX_ONBOARDING_EXPENSES } from '@credit-follow/shared';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { hasRowErrors, validateFilledRows, validateRow, type RowErrors } from './expenseRows';
import { newExpenseRow, type ExpenseRowDraft } from './OnboardingContext';

/**
 * Row editing logic shared by the fixed-expense and variable-budget steps.
 * `addRow` validates the current (last) row and appends another, optional row.
 * `validateAll` validates every filled row (an empty trailing row is ignored).
 */
export function useExpenseRows(
  rows: ExpenseRowDraft[],
  setRows: (fn: (rows: ExpenseRowDraft[]) => ExpenseRowDraft[]) => void,
  otherListNames: string[],
) {
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const nameRefs = useRef<Record<string, TextInput | null>>({});

  function change(key: string, patch: Partial<ExpenseRowDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function remove(key: string) {
    setRows((current) => {
      const remaining = current.filter((row) => row.key !== key);
      return remaining.length > 0 ? remaining : [newExpenseRow()];
    });
  }

  function addRow(): boolean {
    const last = rows[rows.length - 1];
    if (!last) return false;
    const rowErrors = validateRow(last, rows, otherListNames);
    if (hasRowErrors(rowErrors)) {
      setErrors((prev) => ({ ...prev, [last.key]: rowErrors }));
      return false;
    }
    if (rows.length >= MAX_ONBOARDING_EXPENSES) return false;
    const row = newExpenseRow();
    setRows((current) => [...current, row]);
    // Focus the new row's name field once it is rendered.
    setTimeout(() => nameRefs.current[row.key]?.focus(), 50);
    return true;
  }

  function validateAll() {
    const result = validateFilledRows(rows, otherListNames);
    setErrors(result.errors);
    return { valid: Object.keys(result.errors).length === 0, filledCount: result.filled.length };
  }

  return {
    errors,
    nameRefs,
    change,
    remove,
    addRow,
    validateAll,
    canAdd: rows.length < MAX_ONBOARDING_EXPENSES,
  };
}
