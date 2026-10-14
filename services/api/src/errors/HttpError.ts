export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details?: unknown): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): HttpError {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Conflict', details?: unknown): HttpError {
    return new HttpError(409, 'CONFLICT', message, details);
  }

  static serviceUnavailable(code: string, message: string): HttpError {
    return new HttpError(503, code, message);
  }
}
