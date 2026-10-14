import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState, ErrorView, LoadingView } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TransactionRow } from '@/components/TransactionRow';
import { useCategories, useTransactions } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors } from '@/theme';
import { describeError, formatShortDate } from '@/utils/format';
import { formatMinorUnits } from '@/utils/money';

const ALL = 'all';

export default function TransactionsScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; cycleOffset?: string }>();
  const [cycleOffset, setCycleOffset] = useState(() =>
    Math.min(0, Number(params.cycleOffset ?? 0) || 0),
  );
  const [categoryId, setCategoryId] = useState(params.categoryId ?? ALL);
  const categories = useCategories(true);
  const transactions = useTransactions(cycleOffset, categoryId === ALL ? undefined : categoryId);

  const categoryNames = useMemo(
    () => Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const filterOptions = [
    { value: ALL, label: he.transactions.allCategories },
    ...(categories.data ?? [])
      .filter((c) => !c.isArchived || c.id === categoryId)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Screen
      title={he.transactions.title}
      subtitle={
        transactions.data
          ? he.dashboard.cycle(
              formatShortDate(transactions.data.cycle.startDate),
              formatShortDate(transactions.data.cycle.endDate),
            )
          : undefined
      }
      back
      refreshing={transactions.isRefetching}
      onRefresh={() => transactions.refetch()}
      footer={
        <Button
          label={he.expensesScreen.addTransaction}
          icon="add"
          onPress={() => router.push('/transactions/new')}
        />
      }
    >
      <View style={styles.cycleNav}>
        <Button
          label={he.dashboard.previousCycle}
          icon="chevron-forward"
          variant="ghost"
          compact
          onPress={() => setCycleOffset((o) => o - 1)}
        />
        {cycleOffset < 0 && (
          <Button
            label={he.dashboard.nextCycle}
            icon="chevron-back"
            variant="ghost"
            compact
            onPress={() => setCycleOffset((o) => Math.min(0, o + 1))}
          />
        )}
      </View>

      <SegmentedControl wrap options={filterOptions} value={categoryId} onChange={setCategoryId} />

      {transactions.isPending ? (
        <LoadingView />
      ) : transactions.isError ? (
        <ErrorView
          message={describeError(transactions.error)}
          onRetry={() => transactions.refetch()}
        />
      ) : (
        <Card>
          <View style={styles.totalRow}>
            <AppText variant="caption" color={colors.textMuted}>
              {he.transactions.total}
            </AppText>
            <AppText variant="title">{formatMinorUnits(transactions.data.totalMinor)}</AppText>
          </View>
          {transactions.data.transactions.length === 0 ? (
            <EmptyState message={he.transactions.empty} />
          ) : (
            transactions.data.transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categoryName={categoryNames[tx.categoryId] ?? ''}
                onPress={() =>
                  router.push({ pathname: '/transactions/[id]', params: { id: tx.id } })
                }
              />
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cycleNav: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
