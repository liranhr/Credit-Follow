import { z } from 'zod';
import { DEFAULT_TIME_ZONE, FINANCIAL_CYCLE_ANCHORS } from '../constants.js';
import { dayOfMonthSchema, timeZoneSchema } from './common.js';

/**
 * Financial cycle settings. The cycle starts on the day selected by `anchor`:
 * `startDay` (fixed day), `salaryDay` or `creditCardChargeDay`. For months shorter
 * than that day, the cycle starts on the last day of the month. Day boundaries are
 * computed in `timeZone`.
 */
export const financialCycleSchema = z.object({
  anchor: z.enum(FINANCIAL_CYCLE_ANCHORS),
  startDay: dayOfMonthSchema,
  salaryDay: dayOfMonthSchema,
  creditCardChargeDay: dayOfMonthSchema,
  timeZone: timeZoneSchema,
});

export type FinancialCycleSettings = z.infer<typeof financialCycleSchema>;

export const DEFAULT_FINANCIAL_CYCLE: FinancialCycleSettings = {
  anchor: 'calendar_month',
  startDay: 1,
  salaryDay: 1,
  creditCardChargeDay: 10,
  timeZone: DEFAULT_TIME_ZONE,
};
