import {
  DEFAULT_CURRENCY,
  PAYMENT_METHODS,
  SUPPORTED_CURRENCIES,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  type Currency,
  type PaymentMethod,
} from '@credit-follow/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ExpenseTransaction {
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  /** Integer amount in minor units (agorot for ILS). */
  amountMinor: number;
  currency: Currency;
  /**
   * Purchase time. Purchases are entered per day, so this is stored as 12:00 on that
   * day in the user's time zone (safe from off-by-one errors around midnight).
   */
  occurredAt: Date;
  description?: string;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseTransactionDocument = HydratedDocument<ExpenseTransaction>;

const expenseTransactionSchema = new Schema<ExpenseTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountMinor must be an integer' },
    },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: DEFAULT_CURRENCY },
    occurredAt: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: TRANSACTION_DESCRIPTION_MAX_LENGTH },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'credit_card' },
  },
  { timestamps: true },
);

// Supports listing a user's transactions within a financial cycle, optionally by category.
expenseTransactionSchema.index({ userId: 1, occurredAt: -1 });
expenseTransactionSchema.index({ userId: 1, categoryId: 1, occurredAt: -1 });

export const ExpenseTransactionModel = model<ExpenseTransaction>(
  'ExpenseTransaction',
  expenseTransactionSchema,
);
