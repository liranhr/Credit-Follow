import type { CategoryKind, ExpenseCategoryDto } from '@credit-follow/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCategories, useSaveCategory } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors, spacing } from '@/theme';
import { describeError } from '@/utils/format';
import { formatMinorUnits } from '@/utils/money';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Banner, EmptyState, ErrorView, LoadingView } from './Feedback';
import { Screen } from './Screen';
import { Pill } from './StatusBadge';

function CategoryItem({
  category,
  onRestore,
  restoring,
}: {
  category: ExpenseCategoryDto;
  onRestore: () => void;
  restoring: boolean;
}) {
  const amount = formatMinorUnits(category.monthlyBudgetMinor);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.name}
      onPress={() => router.push({ pathname: '/categories/[id]', params: { id: category.id } })}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.itemMain}>
        <View style={styles.itemTitle}>
          <AppText variant="subtitle" numberOfLines={1}>
            {category.name}
          </AppText>
          {category.isArchived && (
            <Pill label={he.dashboard.archived} bg={colors.border} fg={colors.textMuted} />
          )}
        </View>
        <AppText variant="caption" color={colors.textMuted} block>
          {category.kind === 'fixed'
            ? he.fixedScreen.monthlyAmount(amount)
            : category.monthlyBudgetMinor > 0
              ? he.expensesScreen.monthlyBudget(amount)
              : he.dashboard.noBudget}
        </AppText>
      </View>
      {category.isArchived ? (
        <Button
          label={he.expensesScreen.restore}
          variant="secondary"
          compact
          onPress={onRestore}
          loading={restoring}
        />
      ) : (
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/**
 * Manages one kind of item: variable spending budgets ("עריכת תקציב משתנות") or fixed
 * monthly expenses ("עריכת הוצאות קבועות"). Create, edit, archive and restore.
 */
export function CategoryManager({ kind }: { kind: CategoryKind }) {
  const [showArchived, setShowArchived] = useState(false);
  const categories = useCategories(true);
  const save = useSaveCategory();
  const isFixed = kind === 'fixed';

  if (categories.isPending) return <LoadingView />;
  if (categories.isError) {
    return (
      <ErrorView message={describeError(categories.error)} onRetry={() => categories.refetch()} />
    );
  }

  const items = categories.data.filter((c) => c.kind === kind);
  const active = items.filter((c) => !c.isArchived);
  const archived = items.filter((c) => c.isArchived);
  const totalMinor = active.reduce((sum, c) => sum + c.monthlyBudgetMinor, 0);

  return (
    <Screen
      title={isFixed ? he.fixedScreen.title : he.expensesScreen.title}
      back
      refreshing={categories.isRefetching}
      onRefresh={() => categories.refetch()}
    >
      {isFixed ? (
        <AppText variant="caption" color={colors.textMuted} block>
          {he.fixedScreen.hint}
        </AppText>
      ) : (
        <View style={styles.actions}>
          <Button
            label={he.expensesScreen.addTransaction}
            icon="add-circle-outline"
            onPress={() => router.push('/transactions/new')}
            style={styles.flex}
          />
          <Button
            label={he.expensesScreen.transactions}
            icon="receipt-outline"
            variant="secondary"
            onPress={() => router.push('/transactions')}
            style={styles.flex}
          />
        </View>
      )}

      {save.isError && <Banner message={describeError(save.error)} />}

      <Card
        title={isFixed ? he.fixedScreen.section : he.expensesScreen.categories}
        action={
          <Button
            label={isFixed ? he.fixedScreen.add : he.expensesScreen.addCategory}
            icon="add"
            variant="ghost"
            compact
            onPress={() => router.push({ pathname: '/categories/new', params: { kind } })}
          />
        }
      >
        {active.length === 0 ? (
          <EmptyState message={isFixed ? he.fixedScreen.empty : he.expensesScreen.empty} />
        ) : (
          <>
            {active.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                onRestore={() => undefined}
                restoring={false}
              />
            ))}
            <AppText variant="subtitle" block>
              {he.expensesScreen.total(formatMinorUnits(totalMinor))}
            </AppText>
          </>
        )}
      </Card>

      {archived.length > 0 && (
        <Card>
          <Button
            label={
              showArchived
                ? he.expensesScreen.hideArchived
                : `${he.expensesScreen.showArchived} (${archived.length})`
            }
            icon={showArchived ? 'chevron-up' : 'archive-outline'}
            variant="ghost"
            compact
            onPress={() => setShowArchived((v) => !v)}
          />
          {showArchived &&
            archived.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                restoring={save.isPending && save.variables?.id === category.id}
                onRestore={() => save.mutate({ id: category.id, data: { isArchived: false } })}
              />
            ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemMain: { flex: 1, alignItems: 'flex-start', gap: 2 },
  itemTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
