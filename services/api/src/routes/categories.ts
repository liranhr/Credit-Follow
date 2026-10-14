import {
  createExpenseCategorySchema,
  listCategoriesQuerySchema,
  objectIdSchema,
  updateExpenseCategorySchema,
} from '@credit-follow/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors/HttpError.js';
import { getAuth } from '../middleware/requireAuth.js';
import { getValidated, validate } from '../middleware/validate.js';
import { ExpenseCategoryModel, kindFilter } from '../models/expenseCategory.model.js';
import { toCategoryDto } from '../services/serializers.js';

const DUPLICATE_NAME = 'כבר קיימת הוצאה קבועה או קטגוריה בשם זה';

function rethrowDuplicate(error: unknown): never {
  if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000) {
    throw HttpError.conflict(DUPLICATE_NAME, [
      { location: 'body', path: 'name', message: DUPLICATE_NAME },
    ]);
  }
  throw error;
}

export const idParamsSchema = z.object({ id: objectIdSchema });

/**
 * Variable spending budgets and fixed monthly expenses share this endpoint, distinguished by
 * `kind` ('variable' | 'fixed'): GET /categories?kind=fixed, POST { kind: 'fixed', … },
 * PATCH /categories/:id (archive with { isArchived: true }). `kind` cannot be changed.
 */
export function createCategoriesRouter(): Router {
  const router = Router();

  const listSchemas = { query: listCategoriesQuerySchema };
  router.get('/', validate(listSchemas), async (_req, res) => {
    const { userId } = getAuth(res);
    const { includeArchived, kind } = getValidated(res, listSchemas).query;
    const categories = await ExpenseCategoryModel.find({
      userId,
      ...(!includeArchived && { isArchived: false }),
      ...(kind && kindFilter(kind)),
    }).sort({ isArchived: 1, sortOrder: 1, name: 1 });
    res.json(categories.map(toCategoryDto));
  });

  const createSchemas = { body: createExpenseCategorySchema };
  router.post('/', validate(createSchemas), async (_req, res) => {
    const { userId } = getAuth(res);
    const input = getValidated(res, createSchemas).body;
    const last = await ExpenseCategoryModel.findOne({ userId }).sort({ sortOrder: -1 }).lean();
    const category = await ExpenseCategoryModel.create({
      ...input,
      userId,
      sortOrder: last ? last.sortOrder + 1 : 0,
    }).catch(rethrowDuplicate);
    res.status(201).json(toCategoryDto(category));
  });

  const updateSchemas = { params: idParamsSchema, body: updateExpenseCategorySchema };
  router.patch('/:id', validate(updateSchemas), async (_req, res) => {
    const { userId } = getAuth(res);
    const { params, body } = getValidated(res, updateSchemas);
    const category = await ExpenseCategoryModel.findOne({ _id: params.id, userId });
    if (!category) throw HttpError.notFound('הפריט לא נמצא');
    category.set(body);
    await category.save().catch(rethrowDuplicate);
    res.json(toCategoryDto(category));
  });

  return router;
}
