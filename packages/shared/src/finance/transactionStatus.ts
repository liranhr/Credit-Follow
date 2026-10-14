import type { PaymentMethod, TransactionStatus } from '../constants.js';
import type { FinancialCycleSettings } from '../schemas/financialCycle.js';
import {
  addMonths,
  clampDayToMonth,
  compareLocalDates,
  formatLocalDate,
  toLocalDate,
  type LocalDate,
} from './dates.js';

/**
 * The date a credit card purchase is deducted from the bank account: the first
 * occurrence of `chargeDay` strictly after the purchase day (clamped to short months).
 *
 * This is an approximation — real card issuers use a billing cut-off date that is
 * usually a few days before the deduction day.
 */
export function getCreditCardChargeDate(purchasedOn: LocalDate, chargeDay: number): LocalDate {
  const thisMonthDay = clampDayToMonth(purchasedOn.year, purchasedOn.month, chargeDay);
  if (purchasedOn.day < thisMonthDay) {
    return { year: purchasedOn.year, month: purchasedOn.month, day: thisMonthDay };
  }
  const next = addMonths(purchasedOn.year, purchasedOn.month, 1);
  return { ...next, day: clampDayToMonth(next.year, next.month, chargeDay) };
}

export interface TransactionStatusInfo {
  status: TransactionStatus;
  /** Expected bank deduction date (YYYY-MM-DD) for credit card purchases, otherwise null. */
  chargeOn: string | null;
}

export function getTransactionStatus(
  transaction: { paymentMethod: PaymentMethod; occurredOn: LocalDate },
  settings: Pick<FinancialCycleSettings, 'creditCardChargeDay' | 'timeZone'>,
  now: Date,
): TransactionStatusInfo {
  if (transaction.paymentMethod !== 'credit_card') {
    return { status: 'paid', chargeOn: null };
  }
  const chargeDate = getCreditCardChargeDate(transaction.occurredOn, settings.creditCardChargeDay);
  const today = toLocalDate(now, settings.timeZone);
  return {
    status: compareLocalDates(today, chargeDate) >= 0 ? 'charged' : 'pending',
    chargeOn: formatLocalDate(chargeDate),
  };
}

/** The next upcoming credit card deduction date (today counts if it is the charge day). */
export function getNextCreditCardChargeDate(
  settings: Pick<FinancialCycleSettings, 'creditCardChargeDay' | 'timeZone'>,
  now: Date,
): string {
  const today = toLocalDate(now, settings.timeZone);
  const thisMonthDay = clampDayToMonth(today.year, today.month, settings.creditCardChargeDay);
  if (today.day <= thisMonthDay) {
    return formatLocalDate({ ...today, day: thisMonthDay });
  }
  const next = addMonths(today.year, today.month, 1);
  return formatLocalDate({
    ...next,
    day: clampDayToMonth(next.year, next.month, settings.creditCardChargeDay),
  });
}
