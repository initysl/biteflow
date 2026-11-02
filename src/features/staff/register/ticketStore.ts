import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Order, OrderType } from '@shared/schemas';

export interface TicketLine {
  key: string;
  menuItemId: string;
  quantity: number;
  note?: string;
}

interface TicketState {
  /** Set when a held ticket has been recalled, so saving updates it in place. */
  orderId?: string;
  number?: number;
  type: OrderType;
  tableId?: string;
  customerName: string;
  notes: string;
  lines: TicketLine[];
  add(menuItemId: string): void;
  setQuantity(key: string, quantity: number): void;
  setLineNote(key: string, note: string): void;
  setType(type: OrderType): void;
  setTable(tableId?: string): void;
  setCustomerName(name: string): void;
  setNotes(notes: string): void;
  recall(order: Order): void;
  clear(): void;
}

const empty = { orderId: undefined, number: undefined, customerName: '', notes: '', lines: [] as TicketLine[] };

/** The order currently being rung up at this register. Survives a page refresh. */
export const useTicket = create<TicketState>()(
  persist(
    (set) => ({
      ...empty,
      type: 'dine_in',
      tableId: undefined,
      add: (menuItemId) =>
        set((s) => {
          // Tapping an item again adds to the plain line, never to one with a note.
          const plain = s.lines.find((l) => l.menuItemId === menuItemId && !l.note);
          return plain
            ? { lines: s.lines.map((l) => (l === plain ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l)) }
            : { lines: [...s.lines, { key: `${menuItemId}:${Date.now()}`, menuItemId, quantity: 1 }] };
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity } : l)),
        })),
      setLineNote: (key, note) =>
        set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, note: note || undefined } : l)) })),
      setType: (type) => set({ type }),
      setTable: (tableId) => set({ tableId }),
      setCustomerName: (customerName) => set({ customerName }),
      setNotes: (notes) => set({ notes }),
      recall: (order) =>
        set({
          orderId: order.id,
          number: order.number,
          type: order.type,
          tableId: order.tableId ?? undefined,
          customerName: order.customerName ?? '',
          notes: order.notes ?? '',
          lines: order.items.map((i) => ({
            key: i.id,
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            note: i.note ?? undefined,
          })),
        }),
      clear: () => set((s) => ({ ...empty, type: s.type, tableId: s.type === 'dine_in' ? s.tableId : undefined })),
    }),
    { name: 'bf:register-ticket', storage: createJSONStorage(() => sessionStorage) },
  ),
);
