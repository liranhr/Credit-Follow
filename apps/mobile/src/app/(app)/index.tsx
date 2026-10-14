import type { CategoryBudgetSummary } from '@credit-follow/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUser } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Banner, EmptyState, ErrorView, LoadingView } from '@/components/Feedback';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Pill } from '@/components/StatusBadge';
import { TransactionRow } from '@/components/TransactionRow';
import { useCategories, useDashboard } from '@/hooks/api';
import { he } from '@/i18n/he';
import { rtlRootStyle } from '@/i18n/rtl';
import { budgetStatusColors, colors, radii, shadows, spacing } from '@/theme';
import { describeError, formatShortDate } from '@/utils/format';
import { formatMinorUnits } from '@/utils/money';

function CategoryBudgetRow({
  category,
  onPress,
}: {
  category: CategoryBudgetSummary;
  onPress: () => void;
}) {
  const color = budgetStatusColors[category.status];
  const remainingText =
    category.budgetMinor === 0
      ? he.dashboard.noBudget
      : category.remainingMinor >= 0
        ? he.dashboard.remaining(formatMinorUnits(category.remainingMinor))
        : he.dashboard.over(formatMinorUnits(-category.remainingMinor));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${category.name}: ${remainingText}`}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryRow, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.categoryHeader}>
        <View style={styles.categoryName}>
          <AppText variant="subtitle" numberOfLines={1}>
            {category.name}
          </AppText>
          {category.isArchived && (
            <Pill label={he.dashboard.archived} bg={colors.border} fg={colors.textMuted} />
          )}
        </View>
        <AppText
          variant="caption"
          color={category.status === 'over' ? colors.dangerText : colors.textMuted}
        >
          {remainingText}
        </AppText>
      </View>
      <ProgressBar ratio={category.usedRatio ?? (category.spentMinor > 0 ? 1 : 0)} color={color} />
      <AppText variant="caption" color={colors.textMuted} block>
        {category.budgetMinor > 0
          ? he.dashboard.of(
              formatMinorUnits(category.spentMinor),
              formatMinorUnits(category.budgetMinor),
              category.usedPercent,
            )
          : formatMinorUnits(category.spentMinor)}
      </AppText>
    </Pressable>
  );
}

/** One figure of the monthly plan. `accent` marks which group it belongs to. */
function SummaryTile({
  label,
  amountMinor,
  accent,
}: {
  label: string;
  amountMinor: number;
  accent: string;
}) {
  return (
    <View
      style={[styles.tile, { borderStartColor: accent }]}
      accessibilityLabel={`${label}: ${formatMinorUnits(amountMinor)}`}
    >
      <AppText variant="caption" color={colors.textMuted} block numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="subtitle" color={amountMinor < 0 ? colors.dangerText : colors.text} block>
        {formatMinorUnits(amountMinor)}
      </AppText>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const [cycleOffset, setCycleOffset] = useState(0);
  const dashboard = useDashboard(cycleOffset);
  const categories = useCategories(true);

  const categoryNames = useMemo(
    () => Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  if (dashboard.isPending) return <LoadingView />;
  if (dashboard.isError) {
    return (
      <ErrorView message={describeError(dashboard.error)} onRetry={() => dashboard.refetch()} />
    );
  }

  const { cycle, summary, recentTransactions, pendingChargesMinor, nextCreditCardChargeOn } =
    dashboard.data;
  const isCurrent = cycleOffset === 0;
  // "נותר להוציא" = variable budget − actual variable spending in this cycle.
  const overSpent = summary.remainingVariableBudgetMinor < 0;

  return (
    <View style={[styles.flex, rtlRootStyle]}>
      <Screen
        refreshing={dashboard.isRefetching}
        onRefresh={() => {
          dashboard.refetch();
          categories.refetch();
        }}
      >
        <View style={styles.topRow}>
          <View style={styles.flex}>
            <AppText variant="title" block>
              {he.dashboard.hello(user.displayName)}
            </AppText>
            <AppText variant="caption" color={colors.textMuted} block>
              {he.dashboard.cycle(formatShortDate(cycle.startDate), formatShortDate(cycle.endDate))}
              {' · '}
              {isCurrent ? he.dashboard.daysLeft(cycle.daysRemaining) : he.dashboard.pastCycle}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.dashboard.settings}
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* Cycle navigation (RTL: previous = right). */}
        <View style={styles.cycleNav}>
          <Button
            label={he.dashboard.previousCycle}
            icon="chevron-forward"
            variant="ghost"
            compact
            onPress={() => setCycleOffset((o) => o - 1)}
          />
          {!isCurrent && (
            <Button
              label={he.dashboard.nextCycle}
              icon="chevron-back"
              variant="ghost"
              compact
              onPress={() => setCycleOffset((o) => Math.min(0, o + 1))}
            />
          )}
        </View>

        <View style={styles.hero}>
          <AppText variant="caption" color={colors.textOnPrimaryMuted}>
            {he.dashboard.leftToSpend}
          </AppText>
          <AppText style={styles.heroValue} color={overSpent ? '#FCA5A5' : colors.textOnPrimary}>
            {formatMinorUnits(summary.remainingVariableBudgetMinor)}
          </AppText>
          <AppText variant="caption" color={colors.textOnPrimaryMuted} block>
            {summary.variableBudgetMinor > 0
              ? he.dashboard.ofBudget(
                  formatMinorUnits(summary.variableBudgetMinor),
                  formatMinorUnits(summary.variableSpentMinor),
                  summary.variableBudgetUsedPercent,
                )
              : he.dashboard.noBudgets}
          </AppText>
          {overSpent && (
            <AppText variant="caption" color="#FCA5A5" block>
              {he.dashboard.overBudgetTotal(formatMinorUnits(summary.overspentMinor))}
            </AppText>
          )}
          {isCurrent && !overSpent && summary.dailyAllowanceMinor > 0 && (
            <View style={styles.heroPill}>
              <AppText variant="caption" color={colors.textOnPrimary}>
                {he.dashboard.perDay(formatMinorUnits(summary.dailyAllowanceMinor))}
              </AppText>
            </View>
          )}
        </View>

        {summary.fixedExceedsIncome && (
          <Banner tone="warning" message={he.dashboard.fixedExceedsIncome} />
        )}
        {!summary.fixedExceedsIncome && summary.variableOverAllocatedMinor > 0 && (
          <Banner
            tone="warning"
            message={he.dashboard.overAllocated(
              formatMinorUnits(summary.variableOverAllocatedMinor),
            )}
          />
        )}

        <View style={styles.actionsRow}>
          <Button
            label={he.dashboard.editFixed}
            icon="home-outline"
            variant="secondary"
            onPress={() => router.push('/fixed-expenses')}
            style={styles.flex}
          />
          <Button
            label={he.dashboard.editVariable}
            icon="cart-outline"
            variant="secondary"
            onPress={() => router.push('/expenses')}
            style={styles.flex}
          />
        </View>
        <Button
          label={he.dashboard.editIncome}
          icon="wallet-outline"
          variant="secondary"
          onPress={() => router.push('/income')}
        />

        <Card title={he.dashboard.summaryTitle}>
          <View style={styles.grid}>
            <SummaryTile
              label={he.dashboard.income}
              amountMinor={summary.incomeMinor}
              accent={colors.accent}
            />
            <SummaryTile
              label={he.dashboard.fixed}
              amountMinor={summary.fixedExpensesMinor}
              accent={colors.warning}
            />
            <SummaryTile
              label={he.dashboard.afterFixed}
              amountMinor={summary.incomeAfterFixedMinor}
              accent={colors.warning}
            />
            <SummaryTile
              label={he.dashboard.savingsGoal}
              amountMinor={summary.savingsGoalMinor}
              accent={colors.accent}
            />
            <SummaryTile
              label={he.dashboard.variableBudget}
              amountMinor={summary.variableBudgetMinor}
              accent={colors.info}
            />
            <SummaryTile
              label={he.dashboard.variableSpent}
              amountMinor={summary.variableSpentMinor}
              accent={colors.info}
            />
            <SummaryTile
              label={he.dashboard.remainingVariable}
              amountMinor={summary.remainingVariableBudgetMinor}
              accent={colors.info}
            />
            <SummaryTile
              label={he.dashboard.unallocated}
              amountMinor={summary.unallocatedMinor}
              accent={colors.textMuted}
            />
          </View>
        </Card>

        <Card
          title={he.dashboard.variableSection}
          action={
            <Pill
              label={summary.savingsOnTrack ? he.dashboard.onTrack : he.dashboard.offTrack}
              bg={summary.savingsOnTrack ? colors.accentSoft : colors.warningSoft}
              fg={summary.savingsOnTrack ? colors.accentText : colors.warningText}
            />
          }
        >
          {summary.categories.length === 0 ? (
            <EmptyState message={he.dashboard.noBudgets} />
          ) : (
            summary.categories.map((category) => (
              <CategoryBudgetRow
                key={category.id}
                category={category}
                onPress={() =>
                  router.push({
                    pathname: '/transactions',
                    params: { categoryId: category.id, cycleOffset: String(cycleOffset) },
                  })
                }
              />
            ))
          )}
        </Card>

        <Card
          title={he.dashboard.fixedSection}
          action={
            <AppText variant="caption" color={colors.textMuted}>
              {he.dashboard.fixedTotal}: {formatMinorUnits(summary.fixedExpensesMinor)}
            </AppText>
          }
        >
          {summary.fixedExpenses.length === 0 ? (
            <EmptyState message={he.dashboard.noFixed} />
          ) : (
            summary.fixedExpenses.map((item) => (
              <View key={item.id} style={styles.fixedRow}>
                <View style={styles.categoryName}>
                  <AppText variant="body" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  {item.isArchived && (
                    <Pill label={he.dashboard.archived} bg={colors.border} fg={colors.textMuted} />
                  )}
                </View>
                <AppText variant="subtitle">{formatMinorUnits(item.amountMinor)}</AppText>
              </View>
            ))
          )}
          {summary.fixedRecordedMinor > 0 && (
            <AppText variant="caption" color={colors.textMuted} block>
              {he.dashboard.fixedRecorded(formatMinorUnits(summary.fixedRecordedMinor))}
            </AppText>
          )}
        </Card>

        {isCurrent && pendingChargesMinor > 0 && (
          <Card>
            <View style={styles.pendingRow}>
              <Ionicons name="card-outline" size={22} color={colors.warningText} />
              <View style={styles.flex}>
                <AppText variant="subtitle" block>
                  {he.dashboard.pendingCharges}: {formatMinorUnits(pendingChargesMinor)}
                </AppText>
                <AppText variant="caption" color={colors.textMuted} block>
                  {he.dashboard.nextCharge(formatShortDate(nextCreditCardChargeOn))}
                </AppText>
              </View>
            </View>
          </Card>
        )}

        <Card
          title={he.dashboard.recent}
          action={
            <Button
              label={he.dashboard.allTransactions}
              variant="ghost"
              compact
              onPress={() =>
                router.push({
                  pathname: '/transactions',
                  params: { cycleOffset: String(cycleOffset) },
                })
              }
            />
          }
        >
          {recentTransactions.length === 0 ? (
            <EmptyState message={he.dashboard.noTransactions} />
          ) : (
            recentTransactions.map((tx) => (
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
        <View style={{ height: 72 }} />
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={he.dashboard.addExpense}
        onPress={() => router.push('/transactions/new')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="add" size={22} color={colors.textOnPrimary} />
        <AppText variant="subtitle" color={colors.textOnPrimary}>
          {he.dashboard.addExpense}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  cycleNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.sm },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  heroValue: { fontSize: 38, fontWeight: '800' },
  heroPill: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    borderStartWidth: 3,
  },
  categoryRow: { gap: spacing.xs },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  fixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fab: {
    position: 'absolute',
    end: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.accentText,
    ...shadows.card,
    elevation: 6,
  },
});
