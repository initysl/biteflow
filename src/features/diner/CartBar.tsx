import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Order } from '@shared/schemas';
import { useMenu, useMoney } from '@/lib/queries';
import { useCartLines } from '../cart/cartStore';
import { CartSheet } from './CartSheet';
import { useDiner } from './DinerLayout';
import { PaySheet } from './PaySheet';

export function CartBar() {
  const { tableId, canOrder } = useDiner();
  const navigate = useNavigate();
  const money = useMoney();
  const { data: menu } = useMenu();
  const lines = useCartLines(tableId);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<Order | null>(null);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + (menu?.find((m) => m.id === l.menuItemId)?.priceCents ?? 0) * l.quantity, 0);

  return (
    <>
      {canOrder && count > 0 && (
        <div className='animate-arrive fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
          <button
            type='button'
            onClick={() => setCartOpen(true)}
            className='pressable mx-auto flex h-16 w-full max-w-md items-center gap-3 rounded-full bg-accent pr-6 pl-2 text-on-accent shadow-glow'
          >
            <span className='flex size-12 items-center justify-center rounded-full bg-on-accent/15'>
              <ShoppingBag className='size-5' />
            </span>
            <span className='flex-1 text-left text-base font-bold'>View your order</span>
            <span
              key={count}
              className='tabular animate-pop rounded-full bg-on-accent px-2.5 py-0.5 text-xs font-extrabold text-accent'
            >
              {count}
            </span>
            <span className='tabular font-display text-lg font-bold'>{money(subtotal)}</span>
          </button>
        </div>
      )}

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        onPlaced={(order, needsPayment) => {
          setCartOpen(false);
          if (needsPayment) setPayOrder(order);
          else navigate(`/t/${tableId}/orders`);
        }}
      />
      <PaySheet
        order={payOrder}
        onOpenChange={(open) => !open && setPayOrder(null)}
        onPaid={() => {
          setPayOrder(null);
          navigate(`/t/${tableId}/orders`);
        }}
      />
    </>
  );
}
