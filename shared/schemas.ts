import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const CATEGORIES = ['starters', 'mains', 'desserts', 'drinks'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  starters: 'Starters',
  mains: 'Mains',
  desserts: 'Desserts',
  drinks: 'Drinks',
};

/** Kitchen prep stations an item is routed to on the KDS. */
export const STATIONS = ['grill', 'pantry', 'pastry', 'bar'] as const;
export type Station = (typeof STATIONS)[number];
export const STATION_LABELS: Record<Station, string> = {
  grill: 'Grill',
  pantry: 'Pantry',
  pastry: 'Pastry',
  bar: 'Bar',
};

export const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'spicy'] as const;
export type Dietary = (typeof DIETARY)[number];
export const DIETARY_LABELS: Record<Dietary, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  spicy: 'Spicy',
};

/** The 14 major allergens recognised by UK/EU food law. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree-nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  peanuts: 'Peanuts',
  soy: 'Soy',
  milk: 'Milk',
  'tree-nuts': 'Tree nuts',
  celery: 'Celery',
  mustard: 'Mustard',
  sesame: 'Sesame',
  sulphites: 'Sulphites',
  lupin: 'Lupin',
  molluscs: 'Molluscs',
};

/**
 * Order lifecycle. Card orders start in `awaiting_payment` and only reach the
 * kitchen once paid; pay-at-table orders start in `pending`.
 * `completed` is reached automatically once an order is both served and paid.
 */
export const ORDER_STATUSES = [
  'awaiting_payment',
  'pending',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses staff can move an order to by hand, keyed by current status. */
export const STAFF_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'pending'],
  ready: ['served', 'preparing'],
};

export const KITCHEN_STATUSES = ['pending', 'preparing', 'ready'] as const satisfies readonly OrderStatus[];
export const OPEN_STATUSES: readonly OrderStatus[] = ['awaiting_payment', 'pending', 'preparing', 'ready', 'served'];

export const PAYMENT_METHODS = ['card', 'counter'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ['vacant', 'seated', 'billing'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const ASSISTANCE_TYPES = ['water', 'cutlery', 'server', 'other'] as const;
export type AssistanceType = (typeof ASSISTANCE_TYPES)[number];
export const ASSISTANCE_LABELS: Record<AssistanceType, string> = {
  water: 'Water',
  cutlery: 'Cutlery & napkins',
  server: 'Call a server',
  other: 'Something else',
};

export const SPLIT_TYPES = ['single', 'even'] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

// ---------------------------------------------------------------------------
// Entities (server → client)
// ---------------------------------------------------------------------------

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: Category;
  station: Station;
  imageUrl: string | null;
  dietary: Dietary[];
  /** `null` means allergen information has not been provided. */
  allergens: Allergen[] | null;
  available: boolean;
  featured: boolean;
  sortOrder: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  station: Station;
  note: string | null;
}

export interface Order {
  id: string;
  number: number;
  tableId: string;
  status: OrderStatus;
  notes: string | null;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promoCode: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: 'unpaid' | 'paid';
  createdAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  paidAt: string | null;
}

export interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  openTotalCents: number;
  openOrderCount: number;
  billRequest: BillRequest | null;
}

export interface TableWithToken extends RestaurantTable {
  token: string;
}

export interface BillRequest {
  id: string;
  tableId: string;
  split: SplitType;
  people: number;
  createdAt: string;
}

export interface AssistanceRequest {
  id: string;
  tableId: string;
  type: AssistanceType;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Quote {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promo: { code: string; label: string } | null;
  promoError: string | null;
}

export interface AppConfig {
  restaurantName: string;
  currency: string;
  locale: string;
  paymentProvider: 'stripe' | 'demo';
  demoMode: boolean;
}

export interface StaffUser {
  id: string;
  name: string;
}

export interface ReportSummary {
  revenueCents: number;
  orderCount: number;
  averageTicketCents: number;
  averagePrepMinutes: number | null;
  openOrderCount: number;
  occupiedTables: number;
  totalTables: number;
  outstandingCents: number;
  topItems: { name: string; quantity: number; revenueCents: number }[];
  ordersByHour: { hour: number; orders: number; revenueCents: number }[];
}

// ---------------------------------------------------------------------------
// Request payloads (client → server), validated with zod
// ---------------------------------------------------------------------------

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const tableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[a-z0-9-]+$/i, 'Use letters, numbers and dashes only');

export const cartLineSchema = z.object({
  menuItemId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(50),
  note: trimmedOptional(140),
});

export const quoteInputSchema = z.object({
  items: z.array(cartLineSchema).min(1).max(50),
  promoCode: trimmedOptional(32),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

export const placeOrderSchema = quoteInputSchema.extend({
  tableId: tableIdSchema,
  token: z.string().min(1).max(64),
  notes: trimmedOptional(280),
  paymentMethod: z.enum(PAYMENT_METHODS),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export const menuItemInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).default(''),
  priceCents: z.number().int().min(0).max(1_000_00),
  category: z.enum(CATEGORIES),
  station: z.enum(STATIONS),
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .nullable()
    .or(z.literal('').transform(() => null))
    .default(null),
  dietary: z.array(z.enum(DIETARY)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).nullable().default(null),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
});
export type MenuItemInput = z.input<typeof menuItemInputSchema>;

export const tableInputSchema = z.object({
  id: tableIdSchema,
  label: z.string().trim().min(1).max(40),
  seats: z.number().int().min(1).max(40),
});
export type TableInput = z.input<typeof tableInputSchema>;

export const tableUpdateSchema = tableInputSchema.omit({ id: true }).partial();

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const tableAuthSchema = z.object({
  tableId: tableIdSchema,
  token: z.string().min(1).max(64),
});

export const assistanceInputSchema = tableAuthSchema.extend({
  type: z.enum(ASSISTANCE_TYPES),
  note: trimmedOptional(140),
});

export const billRequestInputSchema = tableAuthSchema.extend({
  split: z.enum(SPLIT_TYPES),
  people: z.number().int().min(1).max(40).default(1),
});

export const loginSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
});
