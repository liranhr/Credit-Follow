import {
  CATEGORY_NAME_MAX_LENGTH,
  minorToInputString,
  parseMoneyToMinor,
  type CategoryKind,
  type ExpenseCategoryDto,
} from '@credit-follow/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useSaveCategory } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors } from '@/theme';
import { describeError, fieldErrors } from '@/utils/format';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Banner } from './Feedback';
import { MoneyField } from './MoneyField';
import { Screen } from './Screen';
import { TextField } from './TextField';

/**
 * Create (no `category`) or edit a variable budget or a fixed expense; editing also allows
 * archiving / restoring. The kind of an existing item cannot be changed.
 */
export function CategoryForm({
  category,
  kind: newKind = 'variable',
}: {
  category?: ExpenseCategoryDto;
  kind?: CategoryKind;
}) {
  const save = useSaveCategory();
  const kind = category?.kind ?? newKind;
  const isFixed = kind === 'fixed';
  const [name, setName] = useState(category?.name ?? '');
  const [budget, setBudget] = useState(
    category ? minorToInputString(category.monthlyBudgetMinor) : '',
  );
  const [errors, setErrors] = useState<{ name?: string; budget?: string }>({});
  const [formError, setFormError] = useState<string>();

  async function submit(extra?: { isArchived: boolean }) {
    const trimmed = name.trim();
    const budgetMinor = budget.trim() ? parseMoneyToMinor(budget) : 0;
    const nextErrors = {
      ...(!trimmed && { name: he.errors.nameRequired }),
      ...(budgetMinor === null && { budget: he.errors.amountInvalid }),
      ...(isFixed && budgetMinor === 0 && { budget: he.errors.amountRequired }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || budgetMinor === null) return;

    setFormError(undefined);
    try {
      await save.mutateAsync({
        ...(category ? { id: category.id } : { kind }),
        data: { name: trimmed, monthlyBudgetMinor: budgetMinor, ...extra },
      });
      router.back();
    } catch (e) {
      const fields = fieldErrors(e);
      if (fields.name || fields.monthlyBudgetMinor) {
        setErrors({ name: fields.name, budget: fields.monthlyBudgetMinor });
      } else {
        setFormError(describeError(e));
      }
    }
  }

  const title = category
    ? isFixed
      ? he.categoryForm.editFixedTitle
      : he.categoryForm.editTitle
    : isFixed
      ? he.categoryForm.newFixedTitle
      : he.categoryForm.newTitle;

  return (
    <Screen
      title={title}
      back
      footer={<Button label={he.common.save} onPress={() => submit()} loading={save.isPending} />}
    >
      {formError && <Banner message={formError} />}
      <Card>
        <TextField
          label={isFixed ? he.categoryForm.fixedName : he.categoryForm.name}
          value={name}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          onChangeText={(text) => {
            setName(text);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          error={errors.name}
          autoFocus={!category}
        />
        <MoneyField
          label={isFixed ? he.categoryForm.fixedAmount : he.categoryForm.budget}
          hint={isFixed ? undefined : he.categoryForm.budgetHint}
          value={budget}
          onChangeText={(text) => {
            setBudget(text);
            setErrors((e) => ({ ...e, budget: undefined }));
          }}
          error={errors.budget}
        />
      </Card>
      {category && (
        <Card>
          <AppText variant="caption" color={colors.textMuted} block>
            {he.categoryForm.archiveHint}
          </AppText>
          <Button
            label={category.isArchived ? he.categoryForm.unarchive : he.categoryForm.archive}
            icon={category.isArchived ? 'arrow-undo-outline' : 'archive-outline'}
            variant={category.isArchived ? 'secondary' : 'danger'}
            disabled={save.isPending}
            onPress={() => submit({ isArchived: !category.isArchived })}
          />
        </Card>
      )}
    </Screen>
  );
}
