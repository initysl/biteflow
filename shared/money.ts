/** All money is stored and transported as integer minor units (cents). */

export function formatPrice(cents: number, currency = 'USD', locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Split an amount into `parts` shares that always sum back to the total.
 * Leftover cents go to the first shares, so 1000 / 3 → [334, 333, 333].
 */
export function splitEvenly(totalCents: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
