import { UserModel, type UserDocument } from '../models/user.model.js';
import type { VerifiedIdentity } from './identity.js';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

/**
 * Finds or creates the user for a verified identity.
 *
 * Account linking rule: a new identity is linked to an existing account only when the
 * provider asserts that the email is verified (Google `email_verified`). Unverified emails
 * are never stored, so nobody can claim an account by registering someone else's email
 * with a provider that does not verify it.
 */
export async function findOrCreateUserForIdentity(
  identity: VerifiedIdentity,
  now: Date,
): Promise<UserDocument> {
  const identityFilter = {
    authIdentities: {
      $elemMatch: { provider: identity.provider, providerUserId: identity.providerUserId },
    },
  };

  const existing = await UserModel.findOne(identityFilter);
  if (existing) {
    existing.lastLoginAt = now;
    if (!existing.avatarUrl && identity.avatarUrl) existing.avatarUrl = identity.avatarUrl;
    await existing.save();
    return existing;
  }

  const email = identity.verifiedEmail?.toLowerCase();
  if (email) {
    const linked = await UserModel.findOneAndUpdate(
      { email },
      {
        $addToSet: {
          authIdentities: { provider: identity.provider, providerUserId: identity.providerUserId },
        },
        $set: { lastLoginAt: now },
      },
      { returnDocument: 'after' },
    );
    if (linked) return linked;
  }

  try {
    return await UserModel.create({
      displayName: identity.displayName.slice(0, 100),
      ...(email && { email }),
      ...(identity.avatarUrl && { avatarUrl: identity.avatarUrl }),
      authIdentities: [{ provider: identity.provider, providerUserId: identity.providerUserId }],
      lastLoginAt: now,
    });
  } catch (error) {
    // Two concurrent first logins for the same identity: the other request won.
    if (isDuplicateKeyError(error)) {
      const winner = await UserModel.findOne(identityFilter);
      if (winner) return winner;
    }
    throw error;
  }
}
