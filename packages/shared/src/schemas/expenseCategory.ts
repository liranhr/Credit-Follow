import { z } from 'zod';
import { CATEGORY_KINDS, CATEGORY_NAME_MAX_LENGTH, type CategoryKind } from '../constants.js';
import { hexColorSchema, nonNegativeAmountMinorSchema } from './common.js';

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'יש להזין שם')
  .max(CATEGORY_NAME_MAX_LENGTH, `השם יכול להכיל עד ${CATEGORY_NAME_MAX_LENGTH} תווים`);

export const categoryKindSchema = z.enum(CATEGORY_KINDS);

/**
 * Creates a variable spending budget (default) or a fixed monthly expense (`kind: 'fixed'`).
 * For fixed expenses `monthlyBudgetMinor` is the fixed monthly amount.
 */
export const createExpenseCategorySchema = z.object({
  name: categoryNameSchema,
  kind: categoryKindSchema.default('variable'),
  /** Monthly budget (variable) or monthly amount (fixed); 0 = no budget. */
  monthlyBudgetMinor: nonNegativeAmountMinorSchema.default(0),
  color: hexColorSchema.optional(),
  icon: z.string().trim().min(1).max(50).optional(),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

// Defined without `.default()` so omitted fields are left unchanged on update.
// `kind` cannot be changed after creation.
export const updateExpenseCategorySchema = z
  .object({
    name: categoryNameSchema,
    monthlyBudgetMinor: nonNegativeAmountMinorSchema,
    color: hexColorSchema,
    icon: z.string().trim().min(1).max(50),
    isArchived: z.boolean(),
    sortOrder: z.int().min(0),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'אין שדות לעדכון');

export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  kind: categoryKindSchema.optional(),
});

export interface ExpenseCategoryDto {
  id: string;
  name: string;
  kind: CategoryKind;
  monthlyBudgetMinor: number;
  color?: string;
  icon?: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}
