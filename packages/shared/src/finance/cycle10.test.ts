import { describe, expect, it } from 'vitest';
import { DEFAULT_FINANCIAL_CYCLE, type FinancialCycleSettings } from '../schemas/financialCycle.js';
import { buildBudgetSummary } from './budget.js';
import { getFinancialCycle } from './cycle.js';
import { parseLocalDate } from './dates.js';
import { getCreditCardChargeDate, getTransactionStatus } from './transactionStatus.js';

// Focused verification of a financial cycle that begins on the 10th of the month
// (e.g. salary paid on the 10th), in Israel time (UTC+3 summer / UTC+2 winter).
const s = (overrides: Partial<FinancialCycleSettings> = {}): FinancialCycleSettings => ({
  ...DEFAULT_FINANCIAL_CYCLE,
  anchor: 'salary',
  salaryDay: 10,
  ...overrides,
});
const at = (iso: string) => new Date(iso);

describe('cycle beginning on the 10th', () => {
  it.each([
    // [now (UTC), expected start, expected end (inclusive), days total]
    ['2026-10-10T12:00:00Z', '2026-10-10', '2026-11-09', 31], // first day
    ['2026-10-14T09:00:00Z', '2026-10-10', '2026-11-09', 31], // mid-cycle
    ['2026-11-09T12:00:00Z', '2026-10-10', '2026-11-09', 31], // last day
    ['2026-11-10T12:00:00Z', '2026-11-10', '2026-12-09', 30], // next cycle
    ['2026-10-01T12:00:00Z', '2026-09-10', '2026-10-09', 30], // before the 10th → previous cycle
    ['2026-12-25T12:00:00Z', '2026-12-10', '2027-01-09', 31], // crosses the year
    ['2027-01-05T12:00:00Z', '2026-12-10', '2027-01-09', 31], // early January belongs to December's cycle
    ['2027-02-20T12:00:00Z', '2027-02-10', '2027-03-09', 28], // February (non-leap)
    ['2028-02-20T12:00:00Z', '2028-02-10', '2028-03-09', 29], // February (leap year)
  ])('now=%s → %s … %s (%i days)', (now, start, end, days) => {
    expect(getFinancialCycle(s(), at(now))).toMatchObject({
      startDate: start,
      endDate: end,
      daysTotal: days,
    });
  });

  it('switches exactly at local midnight between the 9th and the 10th (summer time, UTC+3)', () => {
    // 2026-10-09T20:59:59Z = 23:59:59 on Oct 9 in Israel; 21:00:00Z = 00:00 on Oct 10.
    expect(getFinancialCycle(s(), at('2026-10-09T20:59:59Z')).startDate).toBe('2026-09-10');
    expect(getFinancialCycle(s(), at('2026-10-09T21:00:00Z')).startDate).toBe('2026-10-10');
  });

  it('switches exactly at local midnight in winter time (UTC+2)', () => {
    expect(getFinancialCycle(s(), at('2026-12-09T21:59:59Z')).startDate).toBe('2026-11-10');
    expect(getFinancialCycle(s(), at('2026-12-09T22:00:00Z')).startDate).toBe('2026-12-10');
  });

  it('exposes UTC boundaries across the DST change (Oct 25 2026)', () => {
    expect(getFinancialCycle(s(), at('2026-10-14T09:00:00Z'))).toMatchObject({
      startsAt: '2026-10-09T21:00:00.000Z', // Oct 10 00:00 IDT (UTC+3)
      endsAt: '2026-11-09T22:00:00.000Z', // Nov 10 00:00 IST (UTC+2)
    });
  });

  it('counts elapsed / remaining days (remaining includes today)', () => {
    expect(getFinancialCycle(s(), at('2026-10-10T12:00:00Z'))).toMatchObject({
      daysElapsed: 1,
      daysRemaining: 31,
    });
    expect(getFinancialCycle(s(), at('2026-10-14T09:00:00Z'))).toMatchObject({
      daysElapsed: 5,
      daysRemaining: 27,
    });
    expect(getFinancialCycle(s(), at('2026-11-09T12:00:00Z'))).toMatchObject({
      daysElapsed: 31,
      daysRemaining: 1,
    });
  });

  it('gives the same cycle for every anchor set to 10', () => {
    const now = at('2026-10-14T09:00:00Z');
    const expected = getFinancialCycle(s(), now);
    expect(
      getFinancialCycle(s({ anchor: 'credit_card', creditCardChargeDay: 10, salaryDay: 1 }), now),
    ).toEqual(expected);
    expect(
      getFinancialCycle(s({ anchor: 'calendar_month', startDay: 10, salaryDay: 1 }), now),
    ).toEqual(expected);
  });

  it('lists previous cycles via offset', () => {
    const now = at('2026-10-14T09:00:00Z');
    expect(getFinancialCycle(s(), now, -1)).toMatchObject({
      startDate: '2026-09-10',
      endDate: '2026-10-09',
      daysRemaining: 0,
    });
    expect(getFinancialCycle(s(), now, -2)).toMatchObject({
      startDate: '2026-08-10',
      endDate: '2026-09-09',
    });
  });

  it('computes the daily allowance from the remaining budget and days left in the 10th-based cycle', () => {
    const cycle = getFinancialCycle(s(), at('2026-10-14T09:00:00Z')); // 27 days remaining
    const summary = buildBudgetSummary({
      averageMonthlyIncomeMinor: 1_500_000,
      monthlySavingsGoalMinor: 250_000,
      categories: [
        {
          id: 'a',
          name: 'סופר',
          kind: 'variable',
          monthlyBudgetMinor: 1_250_000,
          isArchived: false,
          sortOrder: 0,
        },
      ],
      spentByCategory: { a: 35_000 },
      daysRemaining: cycle.daysRemaining,
    });
    expect(summary.remainingVariableBudgetMinor).toBe(1_215_000); // 1,250,000 − 35,000
    expect(summary.dailyAllowanceMinor).toBe(45_000); // 1,215,000 / 27 days
  });
});

describe('credit card deducted on the 10th', () => {
  const ld = (v: string) => parseLocalDate(v)!;
  it('charges purchases on the next 10th strictly after the purchase day', () => {
    expect(getCreditCardChargeDate(ld('2026-10-09'), 10)).toEqual(ld('2026-10-10'));
    expect(getCreditCardChargeDate(ld('2026-10-10'), 10)).toEqual(ld('2026-11-10'));
    expect(getCreditCardChargeDate(ld('2026-12-31'), 10)).toEqual(ld('2027-01-10'));
  });

  it('flips from pending to charged on the deduction day (local time)', () => {
    const settings = s({ creditCardChargeDay: 10 });
    const purchase = { paymentMethod: 'credit_card' as const, occurredOn: ld('2026-10-20') };
    expect(getTransactionStatus(purchase, settings, at('2026-11-09T20:59:59Z')).status).toBe(
      'pending',
    );
    expect(getTransactionStatus(purchase, settings, at('2026-11-09T22:00:00Z')).status).toBe(
      'charged',
    );
  });
});
