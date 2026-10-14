import { z } from 'zod';
import { isValidTimeZone, parseLocalDate } from '../finance/dates.js';
import { MAX_AMOUNT_MINOR } from '../finance/money.js';

// Validation messages are in Hebrew because they are shown directly in the app UI.

/** 24-character hexadecimal MongoDB ObjectId string. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'מזהה לא תקין');

/** #RGB or #RRGGBB color. */
export const hexColorSchema = z.string().regex(/^#(?:[0-9a-f]{3}){1,2}$/i, 'צבע לא תקין');

/**
 * Money is stored as an integer number of minor units (agorot for ILS)
 * to avoid floating-point rounding errors.
 */
export const amountMinorSchema = z
  .int('הסכום חייב להיות מספר שלם של אגורות')
  .positive('הסכום חייב להיות גדול מאפס')
  .max(MAX_AMOUNT_MINOR, 'הסכום גדול מדי');

/** Like `amountMinorSchema` but allows zero (e.g. a category without a budget). */
export const nonNegativeAmountMinorSchema = z
  .int('הסכום חייב להיות מספר שלם של אגורות')
  .min(0, 'הסכום לא יכול להיות שלילי')
  .max(MAX_AMOUNT_MINOR, 'הסכום גדול מדי');

/** Calendar date `YYYY-MM-DD` (no time, no time zone). */
export const localDateSchema = z
  .string()
  .refine((value) => parseLocalDate(value) !== null, 'תאריך לא תקין');

/** IANA time zone name such as `Asia/Jerusalem`. */
export const timeZoneSchema = z.string().refine(isValidTimeZone, 'אזור זמן לא תקין');

export const dayOfMonthSchema = z
  .int('יום בחודש חייב להיות מספר שלם')
  .min(1, 'יום בחודש חייב להיות בין 1 ל-31')
  .max(31, 'יום בחודש חייב להיות בין 1 ל-31');
