import { CATEGORY_NAME_MAX_LENGTH } from '@credit-follow/shared';
import type { MutableRefObject } from 'react';
import type { TextInput } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MoneyField } from '@/components/MoneyField';
import { TextField } from '@/components/TextField';
import { he } from '@/i18n/he';
import { isEmptyRow, type RowErrors } from './expenseRows';
import type { ExpenseRowDraft } from './OnboardingContext';

interface ExpenseRowsEditorProps {
  rows: ExpenseRowDraft[];
  errors: Record<string, RowErrors>;
  onChange: (key: string, patch: Partial<ExpenseRowDraft>) => void;
  onRemove: (key: string) => void;
  /** Called when the user submits the amount of the last row (keyboard "done"). */
  onSubmitLast: () => void;
  nameRefs: MutableRefObject<Record<string, TextInput | null>>;
  labels: { rowTitle: (n: number) => string; optionalRow: string; namePlaceholder: string };
}

/** Dynamic list of "name + monthly amount" rows used for fixed expenses and variable budgets. */
export function ExpenseRowsEditor({
  rows,
  errors,
  onChange,
  onRemove,
  onSubmitLast,
  nameRefs,
  labels,
}: ExpenseRowsEditorProps) {
  return (
    <>
      {rows.map((row, index) => {
        const isOptional = index > 0 && index === rows.length - 1 && isEmptyRow(row);
        const rowErrors = errors[row.key] ?? {};
        return (
          <Card
            key={row.key}
            title={isOptional ? labels.optionalRow : labels.rowTitle(index + 1)}
            action={
              rows.length > 1 || !isEmptyRow(row) ? (
                <Button
                  label={he.onboarding.remove}
                  icon="trash-outline"
                  variant="ghost"
                  compact
                  onPress={() => onRemove(row.key)}
                />
              ) : undefined
            }
          >
            <TextField
              ref={(input) => {
                nameRefs.current[row.key] = input;
              }}
              label={he.onboarding.nameLabel}
              placeholder={labels.namePlaceholder}
              value={row.name}
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              onChangeText={(name) => onChange(row.key, { name })}
              error={rowErrors.name}
              returnKeyType="next"
            />
            <MoneyField
              label={he.onboarding.amountLabel}
              value={row.amount}
              onChangeText={(amount) => onChange(row.key, { amount })}
              error={rowErrors.amount}
              returnKeyType="done"
              onSubmitEditing={index === rows.length - 1 ? onSubmitLast : undefined}
            />
          </Card>
        );
      })}
    </>
  );
}
