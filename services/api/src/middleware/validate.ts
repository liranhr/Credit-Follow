import type { NextFunction, Request, Response } from 'express';
import type { z, ZodType } from 'zod';
import { HttpError } from '../errors/HttpError.js';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

type Infer<T> = T extends ZodType ? z.output<T> : undefined;

export interface Validated<S extends RequestSchemas> {
  body: Infer<S['body']>;
  query: Infer<S['query']>;
  params: Infer<S['params']>;
}

/**
 * Validates `req.body`, `req.query` and `req.params` against Zod schemas.
 * Parsed (and coerced/defaulted) values are stored on `res.locals.validated`,
 * because Express 5 makes `req.query` read-only. Use `getValidated()` to read them.
 */
export function validate<S extends RequestSchemas>(schemas: S) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const issues: { location: string; path: string; message: string }[] = [];
    const validated: Record<string, unknown> = {};

    for (const location of ['body', 'query', 'params'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        validated[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ location, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      next(HttpError.badRequest(issues[0]?.message ?? 'הנתונים שנשלחו אינם תקינים', issues));
      return;
    }

    res.locals.validated = validated;
    next();
  };
}

export function getValidated<S extends RequestSchemas>(res: Response, _schemas: S): Validated<S> {
  return res.locals.validated as Validated<S>;
}
