export const APP_NAME = 'Credit Follow';

export const DEFAULT_LOCALE = 'he';
export const SUPPORTED_LOCALES = ['he'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_CURRENCY = 'ILS';
export const SUPPORTED_CURRENCIES = ['ILS'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

/** Social sign-in providers offered to end users. */
export const AUTH_PROVIDERS = ['google', 'facebook'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * Identity providers that can be stored on a user. `dev` is only issued by the
 * development-only login endpoint, which the API refuses to enable in production.
 */
export const IDENTITY_PROVIDERS = [...AUTH_PROVIDERS, 'dev'] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

/**
 * What the user's financial cycle is anchored to:
 * - calendar_month: a fixed day of the month (`startDay`, 1 = calendar month)
 * - salary: the day the salary is deposited (`salaryDay`)
 * - credit_card: the credit card deduction day (`creditCardChargeDay`)
 */
export const FINANCIAL_CYCLE_ANCHORS = ['calendar_month', 'salary', 'credit_card'] as const;
export type FinancialCycleAnchor = (typeof FINANCIAL_CYCLE_ANCHORS)[number];

export const PAYMENT_METHODS = [
  'credit_card',
  'debit_card',
  'cash',
  'bank_transfer',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * - pending: credit card purchase that has not been deducted from the bank account yet
 * - charged: credit card purchase whose deduction date has passed
 * - paid: paid immediately (cash, debit card, bank transfer, other)
 */
export const TRANSACTION_STATUSES = ['pending', 'charged', 'paid'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/**
 * - fixed: a fixed monthly expense (rent, loan, insurance…) with a known monthly amount.
 *   It is deducted from income once, in the plan; transactions recorded against it are
 *   kept for history but never deducted again.
 * - variable: a variable spending budget (groceries, fuel…) tracked against actual spending.
 */
export const CATEGORY_KINDS = ['fixed', 'variable'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_NAME_MAX_LENGTH = 40;
export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 200;
export const MAX_ONBOARDING_EXPENSES = 50;
/** Ratio of a category budget at which it is flagged as "close to the limit". */
export const BUDGET_WARNING_RATIO = 0.8;
