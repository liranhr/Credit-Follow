import type {
  AuthProvidersStatus,
  AuthResponse,
  CompleteOnboardingInput,
  CreateExpenseCategoryInput,
  DashboardDto,
  ExpenseCategoryDto,
  ExpenseTransactionDto,
  FacebookSignInInput,
  FinancialCycleInfo,
  PaymentMethod,
  UpdateExpenseCategoryInput,
  UpdateFinanceInput,
  UpdateFinancialCycleInput,
  UserDto,
} from '@credit-follow/shared';
import { apiRequest } from './client';

export interface TransactionsResponse {
  cycle: FinancialCycleInfo;
  totalMinor: number;
  transactions: ExpenseTransactionDto[];
}

export interface TransactionInput {
  categoryId: string;
  amountMinor: number;
  occurredOn: string;
  description?: string;
  paymentMethod: PaymentMethod;
}

export const api = {
  auth: {
    providers: () => apiRequest<AuthProvidersStatus>('/auth/providers', { auth: false }),
    google: (idToken: string) =>
      apiRequest<AuthResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false }),
    facebook: (input: FacebookSignInInput) =>
      apiRequest<AuthResponse>('/auth/facebook', { method: 'POST', body: input, auth: false }),
    dev: (displayName: string) =>
      apiRequest<AuthResponse>('/auth/dev', { method: 'POST', body: { displayName }, auth: false }),
    logout: (refreshToken: string) =>
      apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  },
  me: {
    get: () => apiRequest<UserDto>('/me'),
    updateFinance: (input: UpdateFinanceInput) =>
      apiRequest<UserDto>('/me/finance', { method: 'PUT', body: input }),
    updateFinancialCycle: (input: UpdateFinancialCycleInput) =>
      apiRequest<UserDto>('/me/financial-cycle', { method: 'PUT', body: input }),
    delete: () => apiRequest<void>('/me', { method: 'DELETE' }),
  },
  onboarding: {
    complete: (input: CompleteOnboardingInput) =>
      apiRequest<UserDto>('/onboarding', { method: 'POST', body: input }),
  },
  categories: {
    list: (includeArchived: boolean) =>
      apiRequest<ExpenseCategoryDto[]>(`/categories?includeArchived=${includeArchived}`),
    create: (input: Partial<CreateExpenseCategoryInput> & { name: string }) =>
      apiRequest<ExpenseCategoryDto>('/categories', { method: 'POST', body: input }),
    update: (id: string, input: UpdateExpenseCategoryInput) =>
      apiRequest<ExpenseCategoryDto>(`/categories/${id}`, { method: 'PATCH', body: input }),
  },
  transactions: {
    list: (cycleOffset: number, categoryId?: string) =>
      apiRequest<TransactionsResponse>(
        `/transactions?cycleOffset=${cycleOffset}${categoryId ? `&categoryId=${categoryId}` : ''}`,
      ),
    get: (id: string) => apiRequest<ExpenseTransactionDto>(`/transactions/${id}`),
    create: (input: TransactionInput) =>
      apiRequest<ExpenseTransactionDto>('/transactions', { method: 'POST', body: input }),
    update: (id: string, input: Partial<TransactionInput>) =>
      apiRequest<ExpenseTransactionDto>(`/transactions/${id}`, { method: 'PATCH', body: input }),
    delete: (id: string) => apiRequest<void>(`/transactions/${id}`, { method: 'DELETE' }),
  },
  dashboard: {
    get: (cycleOffset: number) => apiRequest<DashboardDto>(`/dashboard?cycleOffset=${cycleOffset}`),
  },
};
