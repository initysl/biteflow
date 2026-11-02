import { describe, expect, it } from 'vitest';
import { formatPrice, splitEvenly } from '../../shared/money';
import { discountFor } from '../../server/services/pricing';

describe('splitEvenly', () => {
  it('always sums back to the total', () => {
    for (const [total, n] of [
      [1000, 3],
      [999, 4],
      [1, 5],
      [4567, 7],
    ]) {
      const shares = splitEvenly(total, n);
      expect(shares).toHaveLength(n);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
  });
});

describe('discountFor', () => {
  it('handles percent and flat codes and never exceeds the subtotal', () => {
    expect(discountFor({ kind: 'percent', value: 10 }, 2345)).toBe(235);
    expect(discountFor({ kind: 'flat', value: 500 }, 2345)).toBe(500);
    expect(discountFor({ kind: 'flat', value: 500 }, 300)).toBe(300);
  });
});

describe('formatPrice', () => {
  it('formats minor units', () => {
    expect(formatPrice(1850, 'USD', 'en-US')).toBe('$18.50');
  });
});
