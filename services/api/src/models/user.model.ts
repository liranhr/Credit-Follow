import {
  DEFAULT_CURRENCY,
  DEFAULT_FINANCIAL_CYCLE,
  DEFAULT_LOCALE,
  FINANCIAL_CYCLE_ANCHORS,
  IDENTITY_PROVIDERS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  isValidTimeZone,
  type AuthIdentity,
  type UserFinance,
  type UserPreferences,
} from '@credit-follow/shared';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export interface User {
  email?: string;
  displayName: string;
  avatarUrl?: string;
  /** Linked sign-in identities (Google / Facebook, or `dev` in development). */
  authIdentities: AuthIdentity[];
  preferences: UserPreferences;
  finance: UserFinance;
  onboardingCompletedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const authIdentitySchema = new Schema<AuthIdentity>(
  {
    provider: { type: String, enum: IDENTITY_PROVIDERS, required: true },
    providerUserId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const integer = { validator: Number.isInteger, message: '{PATH} must be an integer' };

const dayOfMonth = (defaultValue: number) => ({
  type: Number,
  min: 1,
  max: 31,
  default: defaultValue,
  validate: integer,
});

const amount = { type: Number, min: 0, default: 0, validate: integer };

const userSchema = new Schema<User, Model<User>>(
  {
    // Only provider-verified emails are stored (see auth.service.ts).
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    avatarUrl: { type: String, trim: true, maxlength: 2048 },
    authIdentities: {
      type: [authIdentitySchema],
      validate: {
        validator: (identities: AuthIdentity[]) => identities.length > 0,
        message: 'A user must have at least one auth identity',
      },
    },
    preferences: {
      locale: { type: String, enum: SUPPORTED_LOCALES, default: DEFAULT_LOCALE },
      currency: { type: String, enum: SUPPORTED_CURRENCIES, default: DEFAULT_CURRENCY },
      financialCycle: {
        anchor: {
          type: String,
          enum: FINANCIAL_CYCLE_ANCHORS,
          default: DEFAULT_FINANCIAL_CYCLE.anchor,
        },
        startDay: dayOfMonth(DEFAULT_FINANCIAL_CYCLE.startDay),
        salaryDay: dayOfMonth(DEFAULT_FINANCIAL_CYCLE.salaryDay),
        creditCardChargeDay: dayOfMonth(DEFAULT_FINANCIAL_CYCLE.creditCardChargeDay),
        timeZone: {
          type: String,
          default: DEFAULT_FINANCIAL_CYCLE.timeZone,
          validate: { validator: isValidTimeZone, message: 'Invalid time zone' },
        },
      },
    },
    finance: {
      averageMonthlyIncomeMinor: amount,
      monthlySavingsGoalMinor: amount,
    },
    onboardingCompletedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index(
  { 'authIdentities.provider': 1, 'authIdentities.providerUserId': 1 },
  { unique: true },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

export const UserModel = model<User>('User', userSchema);
