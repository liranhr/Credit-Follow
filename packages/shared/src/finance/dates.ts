/**
 * Time-zone aware calendar helpers built on `Intl` only (no external date library).
 * A `LocalDate` is a calendar day as seen in a specific IANA time zone.
 */

export interface LocalDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

const MS_PER_DAY = 86_400_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(instant: Date, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    // Some engines format midnight as 24 even with h23.
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (e.g. +3h for Israel in summer). */
export function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** The calendar day of `instant` in `timeZone`. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const { year, month, day } = getZonedParts(instant, timeZone);
  return { year, month, day };
}

/** Converts a wall-clock time in `timeZone` to the corresponding UTC instant. */
export function zonedTimeToUtc(date: LocalDate, timeZone: string, hour = 0, minute = 0): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(new Date(guess), timeZone);
  let result = guess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) {
    result = guess - secondOffset;
  }
  return new Date(result);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `day` clamped to the length of the month (e.g. day 31 in February → 28/29). */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function toEpochDay(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

function fromEpochDay(epochDay: number): LocalDate {
  const d = new Date(epochDay * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Number of days from `from` to `to` (negative if `to` is earlier). */
export function diffInDays(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

export function formatLocalDate(date: LocalDate): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`;
}

/** Parses `YYYY-MM-DD`; returns null for malformed or impossible dates (e.g. 2026-02-30). */
export function parseLocalDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}
