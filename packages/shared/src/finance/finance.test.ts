import { describe, expect, it } from 'vitest';
import { DEFAULT_FINANCIAL_CYCLE, type FinancialCycleSettings } from '../schemas/financialCycle.js';
import { getCycleStartDay, getFinancialCycle } from './cycle.js';
import {
  addMonths,
  getTimeZoneOffsetMs,
  parseLocalDate,
  toLocalDate,
  zonedTimeToUtc,
} from './dates.js';
import { minorToInputString, parseMoneyToMinor } from './money.js';
import {
  getCreditCardChargeDate,
  getNextCreditCardChargeDate,
  getTransactionStatus,
} from './transactionStatus.js';

const IL = 'Asia/Jerusalem';
const settings = (overrides: Partial<FinancialCycleSettings> = {}): FinancialCycleSettings => ({
  ...DEFAULT_FINANCIAL_CYCLE,
  ...overrides,
});
const ld = (s: string) => parseLocalDate(s)!;

describe('dates', () => {
  it('converts instants to local dates across the date line', () => {
    // 22:30 UTC on Oct 14 is already Oct 15 in Israel (UTC+3 in October).
    const instant = new Date('2026-10-14T22:30:00Z');
    expect(toLocalDate(instant, IL)).toEqual({ year: 2026, month: 10, day: 15 });
    expect(toLocalDate(instant, 'America/New_York')).toEqual({ year: 2026, month: 10, day: 14 });
  });

  it('computes Israel offsets for winter and summer time', () => {
    expect(getTimeZoneOffsetMs(new Date('2026-01-15T12:00:00Z'), IL)).toBe(2 * 3600_000);
    expect(getTimeZoneOffsetMs(new Date('2026-07-15T12:00:00Z'), IL)).toBe(3 * 3600_000);
  });

  it('converts local midnight to UTC on both sides of DST', () => {
    expect(zonedTimeToUtc(ld('2026-01-01'), IL).toISOString()).toBe('2025-12-31T22:00:00.000Z');
    expect(zonedTimeToUtc(ld('2026-07-01'), IL).toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(zonedTimeToUtc(ld('2026-03-08'), 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(zonedTimeToUtc(ld('2026-03-09'), 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });

  it('adds months across years', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 3, -14)).toEqual({ year: 2025, month: 1 });
  });

  it('parses only real calendar dates', () => {
    expect(parseLocalDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseLocalDate('2026-02-29')).toBeNull();
    expect(parseLocalDate('2026-1-01')).toBeNull();
  });
});

describe('getFinancialCycle', () => {
  it('uses the calendar month by default', () => {
    const cycle = getFinancialCycle(settings(), new Date('2026-10-14T09:00:00Z'));
    expect(cycle).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      startsAt: '2026-09-30T21:00:00.000Z',
      endsAt: '2026-10-31T22:00:00.000Z', // DST ends on Oct 25 2026 → UTC+2
      daysTotal: 31,
      daysElapsed: 14,
      daysRemaining: 18,
    });
  });

  it('starts on the salary day and rolls back before it', () => {
    const s = settings({ anchor: 'salary', salaryDay: 10 });
    expect(getFinancialCycle(s, new Date('2026-10-14T09:00:00Z'))).toMatchObject({
      startDate: '2026-10-10',
      endDate: '2026-11-09',
    });
    expect(getFinancialCycle(s, new Date('2026-10-05T09:00:00Z'))).toMatchObject({
      startDate: '2026-09-10',
      endDate: '2026-10-09',
      daysTotal: 30,
    });
  });

  it('starts exactly at local midnight of the start day', () => {
    const s = settings({ anchor: 'credit_card', creditCardChargeDay: 15 });
    // 2026-10-14T21:00Z is midnight Oct 15 in Israel.
    expect(getFinancialCycle(s, new Date('2026-10-14T20:59:59Z')).startDate).toBe('2026-09-15');
    expect(getFinancialCycle(s, new Date('2026-10-14T21:00:00Z')).startDate).toBe('2026-10-15');
  });

  it('clamps day 31 to short months (non-leap and leap years)', () => {
    const s = settings({ startDay: 31 });
    expect(getFinancialCycle(s, new Date('2027-02-28T12:00:00Z'))).toMatchObject({
      startDate: '2027-02-28',
      endDate: '2027-03-30',
    });
    expect(getFinancialCycle(s, new Date('2027-03-15T12:00:00Z'))).toMatchObject({
      startDate: '2027-02-28',
      endDate: '2027-03-30',
    });
    expect(getFinancialCycle(s, new Date('2028-02-29T12:00:00Z'))).toMatchObject({
      startDate: '2028-02-29',
    });
    expect(getFinancialCycle(s, new Date('2026-04-30T12:00:00Z'))).toMatchObject({
      startDate: '2026-04-30',
      endDate: '2026-05-30',
    });
  });

  it('crosses year boundaries', () => {
    const s = settings({ startDay: 20 });
    expect(getFinancialCycle(s, new Date('2027-01-05T12:00:00Z'))).toMatchObject({
      startDate: '2026-12-20',
      endDate: '2027-01-19',
    });
  });

  it('supports previous cycles via offset', () => {
    const s = settings({ startDay: 10 });
    const now = new Date('2026-10-14T09:00:00Z');
    expect(getFinancialCycle(s, now, -1)).toMatchObject({
      startDate: '2026-09-10',
      endDate: '2026-10-09',
      daysRemaining: 0,
    });
    expect(getFinancialCycle(s, now, -10)).toMatchObject({ startDate: '2025-12-10' });
  });

  it('respects the configured time zone', () => {
    const now = new Date('2026-10-31T23:30:00Z'); // Nov 1 in Israel, Oct 31 in New York
    expect(getFinancialCycle(settings(), now).startDate).toBe('2026-11-01');
    expect(getFinancialCycle(settings({ timeZone: 'America/New_York' }), now).startDate).toBe(
      '2026-10-01',
    );
  });

  it('reads the start day from the selected anchor', () => {
    const s = settings({ startDay: 3, salaryDay: 9, creditCardChargeDay: 15 });
    expect(getCycleStartDay(s)).toBe(3);
    expect(getCycleStartDay({ ...s, anchor: 'salary' })).toBe(9);
    expect(getCycleStartDay({ ...s, anchor: 'credit_card' })).toBe(15);
  });
});

describe('credit card charge dates and statuses', () => {
  it('charges on the next charge day strictly after the purchase', () => {
    expect(getCreditCardChargeDate(ld('2026-10-05'), 10)).toEqual(ld('2026-10-10'));
    expect(getCreditCardChargeDate(ld('2026-10-10'), 10)).toEqual(ld('2026-11-10'));
    expect(getCreditCardChargeDate(ld('2026-12-20'), 2)).toEqual(ld('2027-01-02'));
    expect(getCreditCardChargeDate(ld('2027-01-31'), 31)).toEqual(ld('2027-02-28'));
  });

  it('derives pending / charged / paid', () => {
    const s = settings({ creditCardChargeDay: 10 });
    const now = new Date('2026-10-14T09:00:00Z');
    expect(
      getTransactionStatus({ paymentMethod: 'credit_card', occurredOn: ld('2026-10-12') }, s, now),
    ).toEqual({ status: 'pending', chargeOn: '2026-11-10' });
    expect(
      getTransactionStatus({ paymentMethod: 'credit_card', occurredOn: ld('2026-10-01') }, s, now),
    ).toEqual({ status: 'charged', chargeOn: '2026-10-10' });
    expect(
      getTransactionStatus({ paymentMethod: 'cash', occurredOn: ld('2026-10-12') }, s, now),
    ).toEqual({ status: 'paid', chargeOn: null });
  });

  it('finds the next charge date (today counts)', () => {
    const s = settings({ creditCardChargeDay: 10 });
    expect(getNextCreditCardChargeDate(s, new Date('2026-10-10T09:00:00Z'))).toBe('2026-10-10');
    expect(getNextCreditCardChargeDate(s, new Date('2026-10-11T09:00:00Z'))).toBe('2026-11-10');
  });
});

describe('money parsing', () => {
  it.each([
    ['120', 12_000],
    ['1,234.5', 123_450],
    ['₪ 89.90', 8_990],
    ['0.05', 5],
    ['1,234,567.89', 123_456_789],
    ['12.', 1_200],
  ])('parses %j', (input, expected) => {
    expect(parseMoneyToMinor(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1,23', '12.3.4'])('rejects %j', (input) => {
    expect(parseMoneyToMinor(input)).toBeNull();
  });

  it('formats minor units for inputs', () => {
    expect(minorToInputString(123_450)).toBe('1234.5');
    expect(minorToInputString(1_205)).toBe('12.05');
    expect(minorToInputString(1_200)).toBe('12');
  });
});
