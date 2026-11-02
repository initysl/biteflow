import { eq, inArray } from 'drizzle-orm';
import { formatPrice } from '../../shared/money';
import type { MenuItem, Quote } from '../../shared/schemas';
import type { QuoteInput } from '../../shared/validation';
import type { DB } from '../db/client';
import { menuItems, promoCodes } from '../db/schema';
import { badRequest, conflict } from '../http';
import { toMenuItem } from './menu';

export interface PricedLine {
  item: MenuItem;
  quantity: number;
  note?: string;
  lineTotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  quote: Quote;
}

type PromoRow = typeof promoCodes.$inferSelect;

export function discountFor(promo: Pick<PromoRow, 'kind' | 'value'>, subtotalCents: number): number {
  const raw = promo.kind === 'percent' ? Math.round((subtotalCents * promo.value) / 100) : promo.value;
  return Math.max(0, Math.min(raw, subtotalCents));
}

/**
 * Prices a cart entirely from the database. Client-supplied prices are never trusted.
 */
export function priceCart(
  db: DB,
  input: QuoteInput,
  { currency = 'USD', locale = 'en-US' }: { currency?: string; locale?: string } = {},
): PricedCart {
  const ids = [...new Set(input.items.map((l) => l.menuItemId))];
  const rows = db.select().from(menuItems).where(inArray(menuItems.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, toMenuItem(r)]));

  const lines: PricedLine[] = input.items.map((line) => {
    const item = byId.get(line.menuItemId);
    if (!item) throw badRequest('One of the items in your order is no longer on the menu');
    if (!item.available) throw conflict(`${item.name} is sold out`);
    return {
      item,
      quantity: line.quantity,
      note: line.note || undefined,
      lineTotalCents: item.priceCents * line.quantity,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

  let promo: Quote['promo'] = null;
  let promoError: string | null = null;
  let discountCents = 0;
  const code = input.promoCode?.trim().toUpperCase();
  if (code) {
    const row = db.select().from(promoCodes).where(eq(promoCodes.code, code)).get();
    if (!row || !row.active) {
      promoError = 'That code isn’t recognised';
    } else if (subtotalCents < row.minSubtotalCents) {
      promoError = `Spend ${formatPrice(row.minSubtotalCents, currency, locale)} to use ${row.code}`;
    } else {
      promo = { code: row.code, label: row.label };
      discountCents = discountFor(row, subtotalCents);
    }
  }

  return {
    lines,
    quote: { subtotalCents, discountCents, totalCents: subtotalCents - discountCents, promo, promoError },
  };
}
