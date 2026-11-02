import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Order } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { queryKeys, useConfig, useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { useDiner } from './DinerLayout';

/**
 * Completes payment for an order in `awaiting_payment`. With Stripe configured
 * this hands off to Stripe Checkout; otherwise it runs a clearly labelled demo.
 */
export function PaySheet({
  order,
  onOpenChange,
  onPaid,
}: {
  order: Order | null;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void;
}) {
  const { tableId, token } = useDiner();
  const { data: config } = useConfig();
  const money = useMoney();
  const qc = useQueryClient();
  const [shown, setShown] = useState(order);
  useEffect(() => {
    if (order) setShown(order);
  }, [order]);

  const isStripe = config?.paymentProvider === 'stripe';
  const pay = useMutation({
    mutationFn: async () => {
      if (!shown) return;
      if (isStripe) {
        const res = await api<{ checkout: { redirectUrl?: string } }>(`/orders/${shown.id}/checkout`, {
          method: 'POST',
          body: { tableId, token },
        });
        if (res.checkout.redirectUrl) window.location.assign(res.checkout.redirectUrl);
        return 'redirect';
      }
      await api<Order>('/payments/demo/confirm', { method: 'POST', body: { tableId, token, orderId: shown.id } });
      return 'paid';
    },
    onSuccess: (result) => {
      if (result !== 'paid') return;
      qc.invalidateQueries({ queryKey: queryKeys.tableOrders(tableId) });
      toast.success(`Paid — order #${shown?.number} is on its way to the kitchen`);
      onPaid();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!shown) return null;

  return (
    <Sheet
      open={!!order}
      onOpenChange={onOpenChange}
      title='Complete payment'
      description={`Order #${shown.number} is held until it’s paid.`}
      footer={
        <div className='space-y-3'>
          <Button size='lg' className='w-full' loading={pay.isPending} onClick={() => pay.mutate()}>
            <Lock className='size-4' />
            {isStripe ? 'Continue to secure checkout' : `Pay ${money(shown.totalCents)}`}
          </Button>
          <p className='flex items-center justify-center gap-1.5 text-xs text-ink-subtle'>
            <ShieldCheck className='size-3.5' />
            {isStripe ? 'Payments are processed by Stripe.' : 'Demo mode — no card is charged.'}
          </p>
        </div>
      }
    >
      <div className='px-5 pt-5 pb-6'>
        <div className='relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b241d] via-[#3b3027] to-[#6d3a22] p-5 text-white shadow-raised'>
          <div className='absolute -top-16 -right-10 size-48 rounded-full bg-white/5' />
          <div className='flex h-full flex-col justify-between'>
            <div className='flex items-start justify-between'>
              <span className='font-display text-lg font-semibold'>{config?.restaurantName}</span>
              <span className='rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium'>{isStripe ? 'Stripe' : 'Demo'}</span>
            </div>
            <div>
              <p className='text-xs tracking-wide text-white/60 uppercase'>Amount due</p>
              <p className='tabular font-display text-4xl font-semibold'>{money(shown.totalCents)}</p>
            </div>
          </div>
        </div>
        <ul className='mt-5 space-y-1.5 text-sm text-ink-muted'>
          {shown.items.map((i) => (
            <li key={i.id} className='flex justify-between gap-3'>
              <span>
                {i.quantity} × {i.name}
              </span>
              <span className='tabular'>{money(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
