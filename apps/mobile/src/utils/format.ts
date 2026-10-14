import { addDays, formatLocalDate, parseLocalDate, toLocalDate } from '@credit-follow/shared';
import { ApiError } from '@/api/client';
import { he } from '@/i18n/he';

/** "2026-10-05" → "05/10/2026" */
export function formatDate(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  if (!d) return isoDate;
  return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
}

/** "2026-10-05" → "05/10" */
export function formatShortDate(isoDate: string): string {
  return formatDate(isoDate).slice(0, 5);
}

/** Today's date (YYYY-MM-DD) in the given time zone, falling back to the device clock. */
export function todayIn(timeZone: string): string {
  try {
    return formatLocalDate(toLocalDate(new Date(), timeZone));
  } catch {
    const now = new Date();
    return formatLocalDate({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    });
  }
}

export function shiftDate(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  return d ? formatLocalDate(addDays(d, days)) : isoDate;
}

/** User-facing Hebrew message for any error thrown by the API client. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return he.errors.network;
    return error.message || he.errors.generic;
  }
  return he.errors.generic;
}

/** Maps API validation details to { fieldPath: message }. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const result: Record<string, string> = {};
  for (const detail of error.details as { path?: string; message?: string }[]) {
    if (detail.path && detail.message && !result[detail.path]) result[detail.path] = detail.message;
  }
  return result;
}
