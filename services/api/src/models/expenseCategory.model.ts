import { CATEGORY_KINDS, CATEGORY_NAME_MAX_LENGTH, type CategoryKind } from '@credit-follow/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ExpenseCategory {
  userId: Types.ObjectId;
  name: string;
  /**
   * 'variable' = variable spending budget, 'fixed' = fixed monthly expense.
   * Documents created before this field existed have no value and are variable
   * (see scripts/migrateCategoryKind.ts and `variableKindFilter`).
   */
  kind: CategoryKind;
  /** Variable: monthly budget. Fixed: monthly amount. In minor units (0 = no budget). */
  monthlyBudgetMinor: number;
  color?: string;
  icon?: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseCategoryDocument = HydratedDocument<ExpenseCategory>;

/** Collation used for case-insensitive category name comparisons (index and queries). */
export const CATEGORY_NAME_COLLATION = { locale: 'he', strength: 2 } as const;

const expenseCategorySchema = new Schema<ExpenseCategory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: CATEGORY_NAME_MAX_LENGTH },
    kind: { type: String, enum: CATEGORY_KINDS, default: 'variable', immutable: true },
    monthlyBudgetMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'monthlyBudgetMinor must be an integer' },
    },
    color: { type: String, trim: true, match: /^#(?:[0-9a-f]{3}){1,2}$/i },
    icon: { type: String, trim: true, maxlength: 50 },
    sortOrder: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Names are unique per user across fixed expenses and variable budgets (case-insensitive),
// so the same expense cannot be planned in both groups. Note: the 'simple' collation
// locale ignores `strength`, so a real ICU locale is required for case-insensitivity.
expenseCategorySchema.index(
  { userId: 1, name: 1 },
  { unique: true, collation: CATEGORY_NAME_COLLATION },
);
expenseCategorySchema.index({ userId: 1, isArchived: 1, sortOrder: 1 });
expenseCategorySchema.index({ userId: 1, kind: 1, isArchived: 1 });

/** Query filter for a kind. Legacy documents without `kind` count as variable. */
export function kindFilter(
  kind: CategoryKind,
): { kind: CategoryKind } | { kind: { $ne: CategoryKind } } {
  return kind === 'fixed' ? { kind: 'fixed' } : { kind: { $ne: 'fixed' } };
}

export const ExpenseCategoryModel = model<ExpenseCategory>(
  'ExpenseCategory',
  expenseCategorySchema,
);
