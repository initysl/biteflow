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
        <div className='fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-arrive'>
          <button
            type='button'
            onClick={() => setCartOpen(true)}
            className='pressable mx-auto flex h-15 w-full max-w-md items-center gap-3 rounded-2xl bg-ink pr-5 pl-3 text-canvas shadow-float'
          >
            <span className='relative flex size-10 items-center justify-center rounded-xl bg-canvas/10'>
              <ShoppingBag className='size-5' />
              <span
                key={count}
                className='tabular animate-pop absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent'
              >
                {count}
              </span>
            </span>
            <span className='flex-1 text-left font-medium'>View order</span>
            <span className='tabular font-medium'>{money(subtotal)}</span>
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
