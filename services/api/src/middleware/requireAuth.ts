import type { RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import type { SessionService } from '../auth/session.service.js';
import type { AccessTokenService } from '../auth/tokens.js';
import { HttpError } from '../errors/HttpError.js';

export interface AuthContext {
  userId: Types.ObjectId;
  sessionId: string;
}

/**
 * Requires a valid `Authorization: Bearer <access token>` header for an active session.
 * The user id comes only from the verified token — never from the request body/query.
 */
export function requireAuth(deps: {
  accessTokens: AccessTokenService;
  sessions: SessionService;
}): RequestHandler {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match?.[1]) {
      throw HttpError.unauthorized('נדרשת התחברות');
    }

    let payload;
    try {
      payload = await deps.accessTokens.verify(match[1]);
    } catch {
      throw new HttpError(401, 'TOKEN_INVALID', 'ההתחברות פגה, יש להתחבר מחדש');
    }

    if (!(await deps.sessions.isActive(payload.sessionId, payload.userId))) {
      throw new HttpError(401, 'SESSION_REVOKED', 'ההתחברות בוטלה, יש להתחבר מחדש');
    }

    const auth: AuthContext = {
      userId: new Types.ObjectId(payload.userId),
      sessionId: payload.sessionId,
    };
    res.locals.auth = auth;
    next();
  };
}

export function getAuth(res: Response): AuthContext {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) throw HttpError.unauthorized('נדרשת התחברות');
  return auth;
}
