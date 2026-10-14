import type { FinancialCycleSettings } from '../schemas/financialCycle.js';
import {
  addDays,
  addMonths,
  clampDayToMonth,
  compareLocalDates,
  diffInDays,
  formatLocalDate,
  toLocalDate,
  zonedTimeToUtc,
  type LocalDate,
} from './dates.js';

export interface FinancialCycleInfo {
  timeZone: string;
  /** Day of month the cycle starts on, before clamping to short months. */
  startDay: number;
  /** First day of the cycle (YYYY-MM-DD, in the user's time zone). */
  startDate: string;
  /** Last day of the cycle, inclusive (YYYY-MM-DD). */
  endDate: string;
  /** UTC instant of the cycle start (local midnight). */
  startsAt: string;
  /** UTC instant of the next cycle start (exclusive end). */
  endsAt: string;
  daysTotal: number;
  /** Days elapsed including today (1 on the first day). Only meaningful for the current cycle. */
  daysElapsed: number;
  /** Days remaining including today. 0 for past cycles. */
  daysRemaining: number;
}

/** The day of month the cycle starts on, according to the selected anchor. */
export function getCycleStartDay(settings: FinancialCycleSettings): number {
  switch (settings.anchor) {
    case 'salary':
      return settings.salaryDay;
    case 'credit_card':
      return settings.creditCardChargeDay;
    case 'calendar_month':
      return settings.startDay;
  }
}

function cycleStartInMonth(year: number, month: number, startDay: number): LocalDate {
  return { year, month, day: clampDayToMonth(year, month, startDay) };
}

/** First day of the cycle that contains `date`. */
export function getCycleStartForDate(date: LocalDate, startDay: number): LocalDate {
  const thisMonthStart = cycleStartInMonth(date.year, date.month, startDay);
  if (compareLocalDates(date, thisMonthStart) >= 0) return thisMonthStart;
  const prev = addMonths(date.year, date.month, -1);
  return cycleStartInMonth(prev.year, prev.month, startDay);
}

/**
 * Computes the financial cycle containing `now` (offset 0), or an earlier/later cycle.
 *
 * A cycle starts on `startDay` of a month (clamped to the month's length, so day 31
 * becomes Feb 28/29) at local midnight in the user's time zone, and ends right before
 * the next cycle starts.
 */
export function getFinancialCycle(
  settings: FinancialCycleSettings,
  now: Date,
  offset = 0,
): FinancialCycleInfo {
  const { timeZone } = settings;
  const startDay = getCycleStartDay(settings);
  const today = toLocalDate(now, timeZone);

  const currentStart = getCycleStartForDate(today, startDay);
  const startMonth = addMonths(currentStart.year, currentStart.month, offset);
  const start = cycleStartInMonth(startMonth.year, startMonth.month, startDay);
  const nextMonth = addMonths(start.year, start.month, 1);
  const nextStart = cycleStartInMonth(nextMonth.year, nextMonth.month, startDay);

  const daysTotal = diffInDays(start, nextStart);
  const daysElapsed = Math.min(Math.max(diffInDays(start, today) + 1, 0), daysTotal);
  let daysRemaining: number;
  if (offset === 0) daysRemaining = daysTotal - daysElapsed + 1;
  else if (offset < 0) daysRemaining = 0;
  else daysRemaining = daysTotal;

  return {
    timeZone,
    startDay,
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(addDays(nextStart, -1)),
    startsAt: zonedTimeToUtc(start, timeZone).toISOString(),
    endsAt: zonedTimeToUtc(nextStart, timeZone).toISOString(),
    daysTotal,
    daysElapsed,
    daysRemaining,
  };
}
