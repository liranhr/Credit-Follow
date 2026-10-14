import type {
  CategoryKind,
  UpdateExpenseCategoryInput,
  UpdateFinanceInput,
  UpdateFinancialCycleInput,
} from '@credit-follow/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, type TransactionInput } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';

export const queryKeys = {
  providers: ['auth-providers'] as const,
  dashboard: (cycleOffset: number) => ['dashboard', cycleOffset] as const,
  categories: (includeArchived: boolean) => ['categories', includeArchived] as const,
  transactions: (cycleOffset: number, categoryId?: string) =>
    ['transactions', cycleOffset, categoryId ?? null] as const,
  transaction: (id: string) => ['transaction', id] as const,
};

/** Everything derived from categories / transactions / settings. */
function invalidateFinanceData(queryClient: QueryClient) {
  return Promise.all(
    ['dashboard', 'transactions', 'transaction', 'categories'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

export const useAuthProviders = () =>
  useQuery({ queryKey: queryKeys.providers, queryFn: api.auth.providers, retry: 1 });

export const useDashboard = (cycleOffset: number) =>
  useQuery({
    queryKey: queryKeys.dashboard(cycleOffset),
    queryFn: () => api.dashboard.get(cycleOffset),
  });

export const useCategories = (includeArchived: boolean) =>
  useQuery({
    queryKey: queryKeys.categories(includeArchived),
    queryFn: () => api.categories.list(includeArchived),
  });

export const useTransactions = (cycleOffset: number, categoryId?: string) =>
  useQuery({
    queryKey: queryKeys.transactions(cycleOffset, categoryId),
    queryFn: () => api.transactions.list(cycleOffset, categoryId),
  });

export const useTransaction = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.transaction(id ?? ''),
    queryFn: () => api.transactions.get(id!),
    enabled: Boolean(id),
  });

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      /** Only for new items: 'variable' (default) or 'fixed'. */
      kind?: CategoryKind;
      data: UpdateExpenseCategoryInput & { name?: string };
    }) =>
      input.id
        ? api.categories.update(input.id, input.data)
        : api.categories.create({
            ...input.data,
            name: input.data.name ?? '',
            kind: input.kind ?? 'variable',
          }),
    onSuccess: () => invalidateFinanceData(queryClient),
  });
}

export function useSaveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: TransactionInput }) =>
      input.id
        ? api.transactions.update(input.id, input.data)
        : api.transactions.create(input.data),
    onSuccess: () => invalidateFinanceData(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.transactions.delete(id),
    onSuccess: () => invalidateFinanceData(queryClient),
  });
}

export function useUpdateFinance() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateFinanceInput) => api.me.updateFinance(input),
    onSuccess: (user) => {
      setUser(user);
      return invalidateFinanceData(queryClient);
    },
  });
}

export function useUpdateFinancialCycle() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateFinancialCycleInput) => api.me.updateFinancialCycle(input),
    onSuccess: (user) => {
      setUser(user);
      return invalidateFinanceData(queryClient);
    },
  });
}
