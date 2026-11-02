import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ReceiptText, UtensilsCrossed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { splitEvenly } from '@shared/money';
import type { Order } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DINER_STEPS, ORDER_STATUS_META, stepIndex } from '@/lib/orderStatus';
import { queryKeys, useMoney } from '@/lib/queries';
import { clockTime } from '@/lib/time';
import { Button, buttonClasses } from '@/ui/Button';
import { Badge, Card, EmptyState, Skeleton } from '@/ui/Display';
import { BillSheet } from './BillSheet';
import { useDiner } from './DinerLayout';
import { PaySheet } from './PaySheet';
import { ReceiptDialog } from './ReceiptDialog';

function Timeline({ order }: { order: Order }) {
  const current = stepIndex(order.status);
  const stamps: Record<string, string | null> = {
    pending: order.createdAt,
    preparing: order.preparingAt,
    ready: order.readyAt,
    served: order.servedAt,
  };
  return (
    <ol className='grid grid-cols-4 gap-1.5' aria-label='Order progress'>
      {DINER_STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current && order.status !== 'completed';
        return (
          <li key={step.status} className='min-w-0'>
            <div className='h-1.5 overflow-hidden rounded-full bg-surface-3'>
              <div
                className={cn(
                  'h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-[var(--ease-out)]',
                  done ? 'scale-x-100' : 'scale-x-0',
                  active && 'animate-pulse',
                )}
              />
            </div>
            <p className={cn('mt-2 truncate text-xs font-medium', done ? 'text-ink' : 'text-ink-subtle')}>{step.label}</p>
            <p className='tabular text-xs text-ink-subtle'>
              {done && stamps[step.status] ? clockTime(stamps[step.status]!) : ' '}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order, onPay, onReceipt }: { order: Order; onPay: () => void; onReceipt: () => void }) {
  const { tableId, token } = useDiner();
  const money = useMoney();
  const qc = useQueryClient();
  const meta = ORDER_STATUS_META[order.status];
  const cancel = useMutation({
    mutationFn: () => api<Order>(`/orders/${order.id}/cancel`, { method: 'POST', body: { tableId, token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tableOrders(tableId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card className='animate-arrive overflow-hidden'>
      <div className='flex items-start justify-between gap-3 px-5 pt-5'>
        <div>
          <h2 className='font-display text-2xl font-semibold'>Order #{order.number}</h2>
          <p className='text-sm text-ink-muted'>Placed at {clockTime(order.createdAt)}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div className='px-5 pt-5'>
        {order.status === 'awaiting_payment' ? (
          <div className='rounded-2xl bg-warning-soft p-4 text-sm text-warning'>{meta.diner}</div>
        ) : (
          <>
            <Timeline order={order} />
            <p className='mt-4 text-[15px] text-ink-muted' aria-live='polite'>
              {meta.diner}
            </p>
          </>
        )}
      </div>

      <ul className='mx-5 mt-5 space-y-2 border-t border-line pt-4 text-[15px]'>
        {order.items.map((i) => (
          <li key={i.id} className='flex justify-between gap-3'>
            <span className='min-w-0'>
              <span className='tabular text-ink-muted'>{i.quantity}×</span> {i.name}
              {i.note && <span className='block text-sm text-ink-subtle italic'>“{i.note}”</span>}
            </span>
            <span className='tabular shrink-0 text-ink-muted'>{money(i.unitPriceCents * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-5 py-4'>
        <div>
          <p className='tabular text-lg font-semibold'>{money(order.totalCents)}</p>
          <p className='text-sm text-ink-muted'>
            {order.paymentStatus === 'paid' ? (
              <span className='inline-flex items-center gap-1 text-success'>
                <Check className='size-3.5' /> Paid
              </span>
            ) : order.status === 'awaiting_payment' ? (
              'Payment needed'
            ) : (
              'On your table’s bill'
            )}
          </p>
        </div>
        <div className='flex gap-2'>
          {order.status === 'awaiting_payment' ? (
            <>
              <Button variant='ghost' loading={cancel.isPending} onClick={() => cancel.mutate()}>
                Cancel
              </Button>
              <Button onClick={onPay}>Pay now</Button>
            </>
          ) : order.paymentStatus === 'paid' ? (
            <Button variant='secondary' onClick={onReceipt}>
              <ReceiptText className='size-4' /> Receipt
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Handles the redirect back from Stripe Checkout. */
function useCheckoutReturn() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { tableId } = useDiner();
  const handled = useRef(false);

  useEffect(() => {
    const sessionId = params.get('session_id');
    const cancelled = params.get('cancelled');
    if (handled.current || (!sessionId && !cancelled)) return;
    handled.current = true;
    setParams({}, { replace: true });
    if (cancelled) {
      toast('Payment cancelled', { description: 'Your order is saved — pay whenever you’re ready.' });
      return;
    }
    api<Order>('/payments/stripe/confirm', { method: 'POST', body: { sessionId } })
      .then((o) => toast.success(`Paid — order #${o.number} is with the kitchen`))
      .catch(() => toast('We’re confirming your payment', { description: 'This usually takes a few seconds.' }))
      .finally(() => qc.invalidateQueries({ queryKey: queryKeys.tableOrders(tableId) }));
  }, [params, setParams, qc, tableId]);
}

export function OrdersPage() {
  const { tableId, canOrder, table, orders } = useDiner();
  const money = useMoney();
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  useCheckoutReturn();

  if (!canOrder) {
    return (
      <EmptyState className='mx-auto max-w-2xl' icon={<UtensilsCrossed className='size-6' />} title='Scan to see your orders'>
        Your orders appear here once you’ve scanned the QR code on your table.
      </EmptyState>
    );
  }

  const visible = (orders ?? []).filter((o) => o.status !== 'cancelled');
  const outstanding = table.openTotalCents;
  const bill = table.billRequest;
  const shares = bill?.split === 'even' ? splitEvenly(outstanding, bill.people) : null;

  return (
    <main className='mx-auto max-w-2xl px-4 pt-6 pb-24 sm:px-6'>
      <Link to={`/t/${tableId}`} className='inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink'>
        <ArrowLeft className='size-4' /> Back to menu
      </Link>
      <h1 className='mt-4 font-display text-4xl font-semibold tracking-tight'>Your table</h1>

      {orders === undefined ? (
        <div className='mt-6 space-y-4'>
          <Skeleton className='h-64' />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className='size-6' />}
          title='No orders yet'
          action={
            <Link to={`/t/${tableId}`} className={buttonClasses()}>
              Browse the menu
            </Link>
          }
        >
          Anything you order will appear here so you can follow it from kitchen to table.
        </EmptyState>
      ) : (
        <>
          {outstanding > 0 && (
            <section
              aria-label='Table bill'
              className='mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-5 text-canvas'
            >
              <div>
                <p className='text-sm text-canvas/70'>
                  {bill ? 'Bill requested — a server is on the way' : 'Open on your table'}
                </p>
                <p className='tabular font-display text-3xl font-semibold'>{money(outstanding)}</p>
                {shares && (
                  <p className='mt-0.5 text-sm text-canvas/70'>
                    Split {bill!.people} ways · <span className='tabular'>{money(shares[0])}</span> each
                  </p>
                )}
              </div>
              <Button variant='secondary' className='border-transparent' onClick={() => setBillOpen(true)}>
                {bill ? 'Change split' : 'Request the bill'}
              </Button>
            </section>
          )}

          <div className='mt-6 space-y-4'>
            {visible.map((o) => (
              <OrderCard key={o.id} order={o} onPay={() => setPayOrder(o)} onReceipt={() => setReceipt(o)} />
            ))}
          </div>

          <div className='mt-8 text-center'>
            <Link to={`/t/${tableId}`} className={buttonClasses({ variant: 'soft' })}>
              Order something else
            </Link>
          </div>
        </>
      )}

      <PaySheet order={payOrder} onOpenChange={(o) => !o && setPayOrder(null)} onPaid={() => setPayOrder(null)} />
      <ReceiptDialog order={receipt} onOpenChange={(o) => !o && setReceipt(null)} />
      <BillSheet open={billOpen} onOpenChange={setBillOpen} outstandingCents={outstanding} current={bill} />
    </main>
  );
}
