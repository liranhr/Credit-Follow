import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../errors/HttpError.js';

const INVALID_DATA = 'הנתונים שנשלחו אינם תקינים';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`הנתיב ${req.method} ${req.path} לא נמצא`));
};

function isMongoDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as { type: unknown }).type === 'entity.parse.failed'
  );
}

/** Maps any thrown error to a consistent JSON error response. */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof ZodError) {
    return HttpError.badRequest(
      error.issues[0]?.message ?? INVALID_DATA,
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (isJsonParseError(error)) {
    return HttpError.badRequest('גוף הבקשה אינו JSON תקין');
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return HttpError.badRequest(
      INVALID_DATA,
      Object.values(error.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return HttpError.badRequest(`ערך לא תקין בשדה ${error.path}`);
  }

  if (isMongoDuplicateKeyError(error)) {
    return HttpError.conflict('הפריט כבר קיים');
  }

  return new HttpError(500, 'INTERNAL_SERVER_ERROR', 'אירעה שגיאה בשרת, נסו שוב מאוחר יותר');
}

export function createErrorHandler(options: { exposeStack: boolean }): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const httpError = toHttpError(error);

    if (httpError.statusCode >= 500) {
      console.error(`[api] ${req.method} ${req.originalUrl} failed:`, error);
    }

    const body: ErrorResponseBody & { stack?: string } = {
      error: {
        code: httpError.code,
        message: httpError.message,
        ...(httpError.details !== undefined && { details: httpError.details }),
      },
    };
    if (options.exposeStack && error instanceof Error && httpError.statusCode >= 500) {
      body.stack = error.stack;
    }

    res.status(httpError.statusCode).json(body);
  };
}
