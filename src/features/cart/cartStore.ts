import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartLine {
  key: string;
  menuItemId: string;
  quantity: number;
  note?: string;
}

interface CartState {
  /** Carts are kept per table so switching tables in a demo doesn't mix orders. */
  carts: Record<string, CartLine[]>;
  add(tableId: string, menuItemId: string, quantity?: number, note?: string): void;
  setQuantity(tableId: string, key: string, quantity: number): void;
  clear(tableId: string): void;
}

const lineKey = (menuItemId: string, note?: string) => `${menuItemId}::${note?.trim().toLowerCase() ?? ''}`;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      add: (tableId, menuItemId, quantity = 1, note) =>
        set((s) => {
          const cleanNote = note?.trim() || undefined;
          const key = lineKey(menuItemId, cleanNote);
          const lines = s.carts[tableId] ?? [];
          const existing = lines.find((l) => l.key === key);
          const next = existing
            ? lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l))
            : [...lines, { key, menuItemId, quantity, note: cleanNote }];
          return { carts: { ...s.carts, [tableId]: next } };
        }),
      setQuantity: (tableId, key, quantity) =>
        set((s) => {
          const lines = s.carts[tableId] ?? [];
          const next =
            quantity <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, quantity } : l));
          return { carts: { ...s.carts, [tableId]: next } };
        }),
      clear: (tableId) => set((s) => ({ carts: { ...s.carts, [tableId]: [] } })),
    }),
    { name: 'bf:cart', storage: createJSONStorage(() => sessionStorage) },
  ),
);

const EMPTY: CartLine[] = [];
export const useCartLines = (tableId: string) => useCartStore((s) => s.carts[tableId] ?? EMPTY);
