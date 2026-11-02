import { z } from 'zod';
import {
  ALLERGENS,
  ASSISTANCE_TYPES,
  CATEGORIES,
  DIETARY,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SPLIT_TYPES,
  STATIONS,
} from './schemas';

/**
 * Request payload validators, shared by the server and the staff forms.
 * Kept apart from schemas.ts so the diner bundle doesn't ship zod.
 */

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
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});
