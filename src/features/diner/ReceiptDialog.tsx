import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Order } from '@shared/schemas';
import { useConfig, useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Sheet';

export function ReceiptDialog({ order, onOpenChange }: { order: Order | null; onOpenChange: (open: boolean) => void }) {
  const { data: config } = useConfig();
  const money = useMoney();
  const [shown, setShown] = useState(order);
  useEffect(() => {
    if (order) setShown(order);
  }, [order]);
  if (!shown) return null;

  const paidAt = shown.paidAt ? new Date(shown.paidAt) : null;

  return (
    <Dialog
      open={!!order}
      onOpenChange={onOpenChange}
      title='Receipt'
      footer={
        <>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant='secondary' onClick={() => window.print()}>
            <Printer className='size-4' /> Print
          </Button>
        </>
      }
    >
      <div id='receipt' className='rounded-2xl border border-dashed border-line-strong p-5 text-sm'>
        <div className='text-center'>
          <p className='font-display text-xl font-semibold'>{config?.restaurantName}</p>
          <p className='text-ink-muted'>
            Order #{shown.number} · Table {shown.tableId}
          </p>
          {paidAt && <p className='text-ink-subtle'>{paidAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
        <ul className='mt-5 space-y-1.5 border-t border-dashed border-line-strong pt-4'>
          {shown.items.map((i) => (
            <li key={i.id} className='flex justify-between gap-3'>
              <span>
                {i.quantity} × {i.name}
              </span>
              <span className='tabular'>{money(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className='mt-4 space-y-1 border-t border-dashed border-line-strong pt-4'>
          <div className='flex justify-between text-ink-muted'>
            <dt>Subtotal</dt>
            <dd className='tabular'>{money(shown.subtotalCents)}</dd>
          </div>
          {shown.discountCents > 0 && (
            <div className='flex justify-between text-ink-muted'>
              <dt>Discount {shown.promoCode && `(${shown.promoCode})`}</dt>
              <dd className='tabular'>−{money(shown.discountCents)}</dd>
            </div>
          )}
          <div className='flex justify-between pt-1 text-base font-semibold'>
            <dt>Total paid</dt>
            <dd className='tabular'>{money(shown.totalCents)}</dd>
          </div>
        </dl>
        <p className='mt-5 text-center text-xs text-ink-subtle'>
          Paid {shown.paymentMethod === 'card' ? 'by card' : 'at the table'} · Prices include tax
        </p>
      </div>
    </Dialog>
  );
}
