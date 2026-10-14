import { useLocalSearchParams } from 'expo-router';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { TransactionForm } from '@/components/TransactionForm';
import { useTransaction } from '@/hooks/api';
import { describeError } from '@/utils/format';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transaction = useTransaction(id);

  if (transaction.isPending) return <LoadingView />;
  if (transaction.isError) {
    return (
      <ErrorView message={describeError(transaction.error)} onRetry={() => transaction.refetch()} />
    );
  }
  return <TransactionForm key={transaction.data.id} transaction={transaction.data} />;
}
