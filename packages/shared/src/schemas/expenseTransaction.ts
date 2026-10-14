import { z } from 'zod';
import {
  PAYMENT_METHODS,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  type Currency,
  type PaymentMethod,
  type TransactionStatus,
} from '../constants.js';
import { amountMinorSchema, localDateSchema, objectIdSchema } from './common.js';

const descriptionSchema = z
  .string()
  .trim()
  .max(
    TRANSACTION_DESCRIPTION_MAX_LENGTH,
    `התיאור יכול להכיל עד ${TRANSACTION_DESCRIPTION_MAX_LENGTH} תווים`,
  );

export const createExpenseTransactionSchema = z.object({
  categoryId: objectIdSchema,
  amountMinor: amountMinorSchema,
  /** Day of the purchase as seen by the user (YYYY-MM-DD in the user's time zone). */
  occurredOn: localDateSchema,
  description: descriptionSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('credit_card'),
});

export type CreateExpenseTransactionInput = z.infer<typeof createExpenseTransactionSchema>;

// Defined without `.default()` so omitted fields are left unchanged on update.
export const updateExpenseTransactionSchema = z
  .object({
    categoryId: objectIdSchema,
    amountMinor: amountMinorSchema,
    occurredOn: localDateSchema,
    description: descriptionSchema,
    paymentMethod: z.enum(PAYMENT_METHODS),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'אין שדות לעדכון');

export type UpdateExpenseTransactionInput = z.infer<typeof updateExpenseTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  /** 0 = current financial cycle, -1 = previous cycle, ... */
  cycleOffset: z.coerce.number().int().min(-36).max(0).default(0),
  categoryId: objectIdSchema.optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export interface ExpenseTransactionDto {
  id: string;
  categoryId: string;
  amountMinor: number;
  currency: Currency;
  occurredOn: string;
  description?: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  /** Expected credit card deduction date (YYYY-MM-DD) or null when paid immediately. */
  chargeOn: string | null;
  createdAt: string;
  updatedAt: string;
}
