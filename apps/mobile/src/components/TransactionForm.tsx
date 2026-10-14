import {
  PAYMENT_METHODS,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  minorToInputString,
  parseMoneyToMinor,
  type ExpenseTransactionDto,
  type PaymentMethod,
} from '@credit-follow/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useCurrentUser } from '@/auth/AuthProvider';
import { useCategories, useDeleteTransaction, useSaveTransaction } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors } from '@/theme';
import { describeError, fieldErrors, formatDate, todayIn } from '@/utils/format';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Banner, ConfirmModal, ErrorView, LoadingView } from './Feedback';
import { MoneyField } from './MoneyField';
import { Screen } from './Screen';
import { SegmentedControl } from './SegmentedControl';
import { DateStepper } from './Steppers';
import { StatusBadge } from './StatusBadge';
import { TextField } from './TextField';

/** Record (no `transaction`) or edit / delete an expense transaction. */
export function TransactionForm({ transaction }: { transaction?: ExpenseTransactionDto }) {
  const user = useCurrentUser();
  const today = todayIn(user.preferences.financialCycle.timeZone);
  const categories = useCategories(true);
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  const [amount, setAmount] = useState(
    transaction ? minorToInputString(transaction.amountMinor) : '',
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId);
  const [occurredOn, setOccurredOn] = useState(transaction?.occurredOn ?? today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    transaction?.paymentMethod ?? 'credit_card',
  );
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [errors, setErrors] = useState<{ amount?: string; categoryId?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (categories.isPending) return <LoadingView />;
  if (categories.isError) {
    return (
      <ErrorView message={describeError(categories.error)} onRetry={() => categories.refetch()} />
    );
  }

  // Archived categories can't receive new expenses, but an existing expense keeps its own.
  const selectable = categories.data.filter(
    (c) => !c.isArchived || c.id === transaction?.categoryId,
  );
  const toOption = (c: (typeof selectable)[number]) => ({ value: c.id, label: c.name });
  // Variable budgets first; payments of fixed expenses are listed separately and are never
  // deducted from the variable budget again.
  const options = selectable.filter((c) => c.kind !== 'fixed').map(toOption);
  const fixedOptions = selectable.filter((c) => c.kind === 'fixed').map(toOption);

  async function submit() {
    const amountMinor = parseMoneyToMinor(amount);
    const nextErrors = {
      ...(amountMinor === null && { amount: he.errors.amountInvalid }),
      ...(amountMinor === 0 && { amount: he.errors.amountRequired }),
      ...(!categoryId && { categoryId: he.errors.categoryRequired }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !amountMinor || !categoryId) return;

    setFormError(undefined);
    try {
      await save.mutateAsync({
        ...(transaction && { id: transaction.id }),
        data: {
          amountMinor,
          categoryId,
          occurredOn,
          paymentMethod,
          description: description.trim(),
        },
      });
      router.back();
    } catch (e) {
      const fields = fieldErrors(e);
      if (fields.amountMinor || fields.categoryId) {
        setErrors({ amount: fields.amountMinor, categoryId: fields.categoryId });
      } else {
        setFormError(describeError(e));
      }
    }
  }

  async function confirmRemoval() {
    if (!transaction) return;
    try {
      await remove.mutateAsync(transaction.id);
      setConfirmDelete(false);
      router.back();
    } catch (e) {
      setConfirmDelete(false);
      setFormError(describeError(e));
    }
  }

  return (
    <Screen
      title={transaction ? he.transactions.editTitle : he.transactions.newTitle}
      back
      headerAction={transaction ? <StatusBadge status={transaction.status} /> : undefined}
      footer={
        <>
          <Button
            label={he.common.save}
            onPress={submit}
            loading={save.isPending}
            disabled={options.length + fixedOptions.length === 0}
          />
          {transaction && (
            <Button
              label={he.common.delete}
              icon="trash-outline"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </>
      }
    >
      {formError && <Banner message={formError} />}
      {options.length + fixedOptions.length === 0 && (
        <Banner tone="warning" message={he.transactions.noCategories} />
      )}
      {transaction?.chargeOn && (
        <AppText variant="caption" color={colors.textMuted} block>
          {transaction.status === 'pending'
            ? he.transactions.chargeOn(formatDate(transaction.chargeOn))
            : he.transactions.chargedOn(formatDate(transaction.chargeOn))}
        </AppText>
      )}

      <Card>
        <MoneyField
          label={he.transactions.amount}
          value={amount}
          onChangeText={(text) => {
            setAmount(text);
            setErrors((e) => ({ ...e, amount: undefined }));
          }}
          error={errors.amount}
          autoFocus={!transaction}
        />
        <SegmentedControl
          wrap
          label={he.transactions.category}
          options={options}
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
            setErrors((e) => ({ ...e, categoryId: undefined }));
          }}
        />
        {fixedOptions.length > 0 && (
          <SegmentedControl
            wrap
            label={he.transactions.fixedGroup}
            options={fixedOptions}
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value);
              setErrors((e) => ({ ...e, categoryId: undefined }));
            }}
          />
        )}
        {errors.categoryId && <Banner message={errors.categoryId} />}
      </Card>

      <Card>
        <DateStepper
          label={he.transactions.date}
          value={occurredOn}
          today={today}
          onChange={setOccurredOn}
        />
        <SegmentedControl
          wrap
          label={he.transactions.paymentMethod}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: he.paymentMethods[method],
          }))}
          value={paymentMethod}
          onChange={setPaymentMethod}
        />
        <TextField
          label={`${he.transactions.description} (${he.common.optional})`}
          placeholder={he.transactions.descriptionPlaceholder}
          value={description}
          maxLength={TRANSACTION_DESCRIPTION_MAX_LENGTH}
          onChangeText={setDescription}
        />
      </Card>

      <ConfirmModal
        visible={confirmDelete}
        title={he.transactions.deleteConfirmTitle}
        body={he.transactions.deleteConfirmBody}
        confirmLabel={he.common.delete}
        loading={remove.isPending}
        onConfirm={confirmRemoval}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
