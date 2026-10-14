import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

export interface ExpenseRowDraft {
  key: string;
  name: string;
  amount: string;
}

type RowsSetter = (
  rows: ExpenseRowDraft[] | ((rows: ExpenseRowDraft[]) => ExpenseRowDraft[]),
) => void;

interface OnboardingDraft {
  income: string;
  setIncome: (value: string) => void;
  /** Fixed monthly expenses (rent, loan, insurance…). */
  fixedRows: ExpenseRowDraft[];
  setFixedRows: RowsSetter;
  /** Variable spending budgets (groceries, fuel…). */
  variableRows: ExpenseRowDraft[];
  setVariableRows: RowsSetter;
  savings: string;
  setSavings: (value: string) => void;
}

let rowCounter = 0;
export function newExpenseRow(): ExpenseRowDraft {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, name: '', amount: '' };
}

const OnboardingContext = createContext<OnboardingDraft | null>(null);

/**
 * Keeps the onboarding answers while moving between the steps (income → fixed expenses →
 * variable budgets → savings). Everything is submitted once, by "לסיום", so the user can go
 * back and edit any step before finishing.
 */
export function OnboardingProvider({ children }: PropsWithChildren) {
  const [income, setIncome] = useState('');
  const [fixedRows, setFixedRows] = useState<ExpenseRowDraft[]>(() => [newExpenseRow()]);
  const [variableRows, setVariableRows] = useState<ExpenseRowDraft[]>(() => [newExpenseRow()]);
  const [savings, setSavings] = useState('');
  const value = useMemo(
    () => ({
      income,
      setIncome,
      fixedRows,
      setFixedRows,
      variableRows,
      setVariableRows,
      savings,
      setSavings,
    }),
    [income, fixedRows, variableRows, savings],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingDraft {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return context;
}
