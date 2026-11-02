import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type {
  Allergen,
  AssistanceType,
  Category,
  Dietary,
  OrderStatus,
  PaymentMethod,
  SplitType,
  Station,
} from '../../shared/schemas';

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  category: text('category').$type<Category>().notNull(),
  station: text('station').$type<Station>().notNull(),
  imageUrl: text('image_url'),
  dietary: text('dietary', { mode: 'json' }).$type<Dietary[]>().notNull().default([]),
  allergens: text('allergens', { mode: 'json' }).$type<Allergen[] | null>(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const restaurantTables = sqliteTable('restaurant_tables', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  seats: integer('seats').notNull().default(4),
  token: text('token').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: integer('number').notNull().unique(),
    tableId: text('table_id')
      .notNull()
      .references(() => restaurantTables.id, { onDelete: 'cascade' }),
    status: text('status').$type<OrderStatus>().notNull(),
    notes: text('notes'),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    promoCode: text('promo_code'),
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull(),
    paymentStatus: text('payment_status').$type<'unpaid' | 'paid'>().notNull().default('unpaid'),
    paymentRef: text('payment_ref'),
    createdAt: createdAt(),
    preparingAt: text('preparing_at'),
    readyAt: text('ready_at'),
    servedAt: text('served_at'),
    paidAt: text('paid_at'),
    completedAt: text('completed_at'),
  },
  (t) => [index('orders_table_idx').on(t.tableId), index('orders_status_idx').on(t.status)],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: text('menu_item_id').notNull(),
    name: text('name').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    station: text('station').$type<Station>().notNull(),
    note: text('note'),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const billRequests = sqliteTable('bill_requests', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => restaurantTables.id, { onDelete: 'cascade' }),
  split: text('split').$type<SplitType>().notNull(),
  people: integer('people').notNull().default(1),
  createdAt: createdAt(),
  settledAt: text('settled_at'),
});

export const assistanceRequests = sqliteTable('assistance_requests', {
  id: text('id').primaryKey(),
  tableId: text('table_id')
    .notNull()
    .references(() => restaurantTables.id, { onDelete: 'cascade' }),
  type: text('type').$type<AssistanceType>().notNull(),
  note: text('note'),
  createdAt: createdAt(),
  resolvedAt: text('resolved_at'),
});

export const promoCodes = sqliteTable('promo_codes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  kind: text('kind').$type<'percent' | 'flat'>().notNull(),
  /** Percent (0–100) for `percent`, cents for `flat`. */
  value: integer('value').notNull(),
  minSubtotalCents: integer('min_subtotal_cents').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const staffUsers = sqliteTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  pinHash: text('pin_hash').notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable('sessions', {
  /** sha256 of the cookie token — the raw token is never stored. */
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => staffUsers.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: createdAt(),
});
