/** Largest amount accepted anywhere in the app: ₪1,000,000,000.00 in agorot. */
export const MAX_AMOUNT_MINOR = 100_000_000_000;

/**
 * Parses user-typed money ("1,234.5", "₪ 89.90", "120") into integer minor units.
 * Returns null for empty, negative, non-numeric input or more than 2 decimals.
 * Parsing is done on the string, so there are no floating-point rounding errors.
 */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.replace(/[\s₪‏‎]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const minor = whole * 100 + fraction;
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

/** Formats minor units for an editable text field: 123450 → "1234.5", 1200 → "12". */
export function minorToInputString(amountMinor: number): string {
  const whole = Math.trunc(amountMinor / 100);
  const fraction = Math.abs(amountMinor % 100);
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
