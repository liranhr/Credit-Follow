/**
 * Formats integer minor units (agorot) as shekels, e.g. 123450 → "1,234.50 ₪", 1200 → "12 ₪".
 * Implemented without Intl so the output is identical on Hermes, iOS, Android and web.
 */
export function formatMinorUnits(amountMinor: number): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.round(amountMinor));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = abs % 100;
  const number = fraction === 0 ? whole : `${whole}.${String(fraction).padStart(2, '0')}`;
  // U+200E (LRM) keeps the minus sign next to the number inside right-to-left text.
  return `${negative ? '‎-' : ''}${number} ₪`;
}
