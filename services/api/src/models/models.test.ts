import { Error as MongooseError, Types, type Document } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ExpenseCategoryModel, ExpenseTransactionModel, UserModel } from './index.js';

// Schema-level validation only (no database connection required).

/** Runs Mongoose validation and returns the error map, or undefined when valid. */
async function validationErrors(doc: Document) {
  try {
    await doc.validate();
    return undefined;
  } catch (error) {
    if (error instanceof MongooseError.ValidationError) return error.errors;
    throw error;
  }
}

describe('UserModel', () => {
  it('applies Hebrew/ILS/calendar-month defaults', async () => {
    const user = new UserModel({
      displayName: 'ישראל ישראלי',
      email: 'User@Example.com',
      authIdentities: [{ provider: 'google', providerUserId: 'google-123' }],
    });
    expect(await validationErrors(user)).toBeUndefined();
    expect(user.email).toBe('user@example.com');
    expect(user.preferences.locale).toBe('he');
    expect(user.preferences.currency).toBe('ILS');
    expect(user.preferences.financialCycle).toMatchObject({
      anchor: 'calendar_month',
      startDay: 1,
    });
  });

  it('requires at least one auth identity and a valid provider', async () => {
    expect(
      await validationErrors(new UserModel({ displayName: 'a', authIdentities: [] })),
    ).toHaveProperty('authIdentities');
    expect(
      await validationErrors(
        new UserModel({
          displayName: 'a',
          authIdentities: [{ provider: 'twitter', providerUserId: '1' }],
        }),
      ),
    ).toBeDefined();
  });

  it('validates the financial cycle start day', async () => {
    const user = new UserModel({
      displayName: 'a',
      authIdentities: [{ provider: 'facebook', providerUserId: 'fb-1' }],
      preferences: { financialCycle: { anchor: 'credit_card', startDay: 32 } },
    });
    expect(await validationErrors(user)).toHaveProperty(['preferences.financialCycle.startDay']);
  });
});

describe('ExpenseCategoryModel', () => {
  it('validates name and color', async () => {
    const userId = new Types.ObjectId();
    expect(
      await validationErrors(new ExpenseCategoryModel({ userId, name: 'דלק', color: '#22c55e' })),
    ).toBeUndefined();
    const errors = await validationErrors(new ExpenseCategoryModel({ userId, color: 'green' }));
    expect(errors).toHaveProperty('name');
    expect(errors).toHaveProperty('color');
  });
});

describe('ExpenseTransactionModel', () => {
  const base = {
    userId: new Types.ObjectId(),
    categoryId: new Types.ObjectId(),
    occurredAt: new Date('2026-10-01'),
  };

  it('accepts integer minor-unit amounts with defaults', async () => {
    const tx = new ExpenseTransactionModel({ ...base, amountMinor: 4990 });
    expect(await validationErrors(tx)).toBeUndefined();
    expect(tx.currency).toBe('ILS');
    expect(tx.paymentMethod).toBe('credit_card');
  });

  it.each([0, -5, 12.5])('rejects amountMinor %s', async (amountMinor) => {
    expect(
      await validationErrors(new ExpenseTransactionModel({ ...base, amountMinor })),
    ).toHaveProperty('amountMinor');
  });
});
