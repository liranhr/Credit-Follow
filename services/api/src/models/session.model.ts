import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * A login session. The refresh token itself is never stored — only its SHA-256 hash.
 * Refresh tokens are rotated on every use; previous hashes are kept so that reuse of
 * an old (possibly stolen) refresh token can be detected and the session revoked.
 */
export interface Session {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  rotatedTokenHashes: string[];
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: 'logout' | 'reuse_detected' | 'account_deleted';
  lastUsedAt: Date;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;

const sessionSchema = new Schema<Session>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    rotatedTokenHashes: { type: [String], default: [], index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, enum: ['logout', 'reuse_detected', 'account_deleted'] },
    lastUsedAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<Session>('Session', sessionSchema);
