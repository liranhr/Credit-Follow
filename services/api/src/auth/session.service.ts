import type { AuthTokens } from '@credit-follow/shared';
import { Types } from 'mongoose';
import { HttpError } from '../errors/HttpError.js';
import { SessionModel } from '../models/session.model.js';
import { generateRefreshToken, hashToken, type AccessTokenService } from './tokens.js';

const MAX_ROTATED_HASHES = 50;
const MS_PER_DAY = 86_400_000;

export interface SessionService {
  create(userId: Types.ObjectId, userAgent?: string): Promise<AuthTokens & { userId: string }>;
  refresh(refreshToken: string): Promise<AuthTokens & { userId: string }>;
  revoke(refreshToken: string): Promise<void>;
  revokeAllForUser(userId: Types.ObjectId, reason: 'account_deleted'): Promise<void>;
  isActive(sessionId: string, userId: string): Promise<boolean>;
}

export function createSessionService(options: {
  accessTokens: AccessTokenService;
  refreshTokenTtlDays: number;
  now?: () => Date;
}): SessionService {
  const now = options.now ?? (() => new Date());
  const ttlMs = options.refreshTokenTtlDays * MS_PER_DAY;

  async function issueTokens(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    refreshToken: string,
    expiresAt: Date,
  ) {
    const access = await options.accessTokens.sign({
      userId: userId.toString(),
      sessionId: sessionId.toString(),
    });
    return {
      userId: userId.toString(),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  return {
    async create(userId, userAgent) {
      const refreshToken = generateRefreshToken();
      const expiresAt = new Date(now().getTime() + ttlMs);
      const session = await SessionModel.create({
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        lastUsedAt: now(),
        ...(userAgent && { userAgent: userAgent.slice(0, 300) }),
      });
      return issueTokens(session._id, userId, refreshToken, expiresAt);
    },

    async refresh(refreshToken) {
      const hash = hashToken(refreshToken);
      const newRefreshToken = generateRefreshToken();
      const current = now();
      const expiresAt = new Date(current.getTime() + ttlMs);

      // Atomic rotation: only one request can consume a given refresh token.
      const session = await SessionModel.findOneAndUpdate(
        { refreshTokenHash: hash, revokedAt: { $exists: false }, expiresAt: { $gt: current } },
        {
          $set: { refreshTokenHash: hashToken(newRefreshToken), lastUsedAt: current, expiresAt },
          $push: { rotatedTokenHashes: { $each: [hash], $slice: -MAX_ROTATED_HASHES } },
        },
        { returnDocument: 'after' },
      );

      if (!session) {
        // An already-rotated token was presented again: it may have been stolen.
        // Revoke the whole session so neither party can keep using it.
        const reused = await SessionModel.findOneAndUpdate(
          { rotatedTokenHashes: hash, revokedAt: { $exists: false } },
          { $set: { revokedAt: current, revokedReason: 'reuse_detected' } },
        );
        if (reused) {
          console.warn(
            `[auth] Refresh token reuse detected; revoked session ${reused._id.toString()}`,
          );
        }
        throw HttpError.unauthorized('ההתחברות פגה, יש להתחבר מחדש');
      }

      return issueTokens(session._id, session.userId, newRefreshToken, expiresAt);
    },

    async revoke(refreshToken) {
      await SessionModel.updateOne(
        { refreshTokenHash: hashToken(refreshToken), revokedAt: { $exists: false } },
        { $set: { revokedAt: now(), revokedReason: 'logout' } },
      );
    },

    async revokeAllForUser(userId, reason) {
      await SessionModel.updateMany(
        { userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: now(), revokedReason: reason } },
      );
    },

    async isActive(sessionId, userId) {
      if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) return false;
      const found = await SessionModel.exists({
        _id: sessionId,
        userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: now() },
      });
      return found !== null;
    },
  };
}
