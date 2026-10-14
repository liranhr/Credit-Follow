import { z } from 'zod';
import { IDENTITY_PROVIDERS, SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from '../constants.js';
import { nonNegativeAmountMinorSchema, amountMinorSchema } from './common.js';
import { financialCycleSchema } from './financialCycle.js';

export const authIdentitySchema = z.object({
  provider: z.enum(IDENTITY_PROVIDERS),
  providerUserId: z.string().min(1),
});

export type AuthIdentity = z.infer<typeof authIdentitySchema>;

export const userPreferencesSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  financialCycle: financialCycleSchema,
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const userFinanceSchema = z.object({
  /** Average monthly net income over the previous six months. */
  averageMonthlyIncomeMinor: nonNegativeAmountMinorSchema,
  monthlySavingsGoalMinor: nonNegativeAmountMinorSchema,
});

export type UserFinance = z.infer<typeof userFinanceSchema>;

const SAVINGS_ABOVE_INCOME = 'יעד החיסכון לא יכול להיות גבוה מההכנסה החודשית';

/** PUT /me/finance — update income and/or savings goal. */
export const updateFinanceSchema = z
  .object({
    averageMonthlyIncomeMinor: amountMinorSchema.optional(),
    monthlySavingsGoalMinor: nonNegativeAmountMinorSchema.optional(),
  })
  .refine(
    (v) => v.averageMonthlyIncomeMinor !== undefined || v.monthlySavingsGoalMinor !== undefined,
    'יש לעדכן לפחות שדה אחד',
  )
  .refine(
    (v) =>
      v.averageMonthlyIncomeMinor === undefined ||
      v.monthlySavingsGoalMinor === undefined ||
      v.monthlySavingsGoalMinor <= v.averageMonthlyIncomeMinor,
    { message: SAVINGS_ABOVE_INCOME, path: ['monthlySavingsGoalMinor'] },
  );

export type UpdateFinanceInput = z.infer<typeof updateFinanceSchema>;

/** PUT /me/financial-cycle — replaces the cycle settings. */
export const updateFinancialCycleSchema = financialCycleSchema;
export type UpdateFinancialCycleInput = z.infer<typeof updateFinancialCycleSchema>;

export { SAVINGS_ABOVE_INCOME as SAVINGS_ABOVE_INCOME_MESSAGE };

/** Public user shape returned by the API. */
export interface UserDto {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  providers: AuthIdentity['provider'][];
  preferences: UserPreferences;
  finance: UserFinance;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
