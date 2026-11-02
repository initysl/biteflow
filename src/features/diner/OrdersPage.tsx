import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BellRing, Check, ReceiptText, UtensilsCrossed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { splitEvenly } from '@shared/money';
import type { Order, OrderStatus } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DINER_STEPS, ORDER_STATUS_META, stepIndex } from '@/lib/orderStatus';
import { queryKeys, useMenu, useMoney } from '@/lib/queries';
import { clockTime } from '@/lib/time';
import { Button, buttonClasses } from '@/ui/Button';
import { Badge, EmptyState, FoodImage, Skeleton, StatusDot } from '@/ui/Display';
import { BillSheet } from './BillSheet';
import { useDiner } from './DinerLayout';
import { PaySheet } from './PaySheet';
import { ReceiptDialog } from './ReceiptDialog';

const HEADLINE: Record<OrderStatus, string> = {
  awaiting_payment: 'Payment needed',
  pending: 'Sent to the kitchen',
  preparing: 'Cooking now',
  ready: 'On its way',
  served: 'Enjoy your meal',
  completed: 'All done',
  cancelled: 'Cancelled',
};

function Progress({ order }: { order: Order }) {
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
            <p className={cn('mt-2 truncate text-xs', done ? 'font-bold text-ink' : 'font-semibold text-ink-subtle')}>
              {step.label}
            </p>
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
  const { data: menu } = useMenu();
  const qc = useQueryClient();
  const meta = ORDER_STATUS_META[order.status];
  const live = !['completed', 'cancelled', 'awaiting_payment'].includes(order.status);
  const cancel = useMutation({
    mutationFn: () => api<Order>(`/orders/${order.id}/cancel`, { method: 'POST', body: { tableId, token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tableOrders(tableId) }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <article className='animate-arrive rounded-[28px] bg-surface p-5 shadow-card'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-bold text-ink-muted'>
            Order #{order.number} · {clockTime(order.createdAt)}
          </p>
          <h2 className='mt-1 font-display text-2xl font-bold'>
            <span className='sr-only'>Order #{order.number}: </span>
            {HEADLINE[order.status]}
          </h2>
        </div>
        {live ? (
          <span className='flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-ink'>
            <StatusDot tone='accent' pulse /> Live
          </span>
        ) : (
          <Badge tone={meta.tone}>{meta.label}</Badge>
        )}
      </div>

      <div className='mt-5'>
        {order.status === 'awaiting_payment' ? (
          <p className='rounded-2xl bg-warning-soft p-4 text-sm font-medium text-warning'>{meta.diner}</p>
        ) : (
          <>
            <Progress order={order} />
            <p className='mt-4 text-[15px] text-ink-muted' aria-live='polite'>
              {meta.diner}
            </p>
          </>
        )}
      </div>

      <ul className='mt-5 space-y-3 border-t border-dashed border-line-strong pt-4'>
        {order.items.map((i) => {
          const image = menu?.find((m) => m.id === i.menuItemId)?.imageUrl ?? null;
          return (
            <li key={i.id} className='flex items-center gap-3'>
              <FoodImage src={image} alt={i.name} className='size-12 shrink-0 rounded-2xl' />
              <div className='min-w-0 flex-1'>
                <p className='font-bold'>
                  <span className='tabular'>{i.quantity} ×</span> {i.name}
                </p>
                {i.note && <p className='truncate text-sm text-ink-muted'>“{i.note}”</p>}
              </div>
              <span className='tabular shrink-0 font-bold'>{money(i.unitPriceCents * i.quantity)}</span>
            </li>
          );
        })}
      </ul>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3'>
        <div>
          <p className='tabular font-display text-xl font-bold'>{money(order.totalCents)}</p>
          <p className='text-sm text-ink-muted'>
            {order.paymentStatus === 'paid' ? (
              <span className='inline-flex items-center gap-1 font-bold text-success'>
                <Check className='size-3.5' strokeWidth={3} /> Paid
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
    </article>
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
  const { tableId, canOrder, table, orders, openAssistance, assistance } = useDiner();
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
  const openCount = visible.filter((o) => o.paymentStatus === 'unpaid' && o.status !== 'awaiting_payment').length;

  return (
    <main className='mx-auto max-w-2xl px-4 pt-2 pb-32 sm:px-6'>
      <div className='flex items-center gap-3'>
        <Link
          to={`/t/${tableId}`}
          aria-label='Back to menu'
          className='pressable flex size-11 items-center justify-center rounded-full bg-surface shadow-card hover:bg-surface-2'
        >
          <ArrowLeft className='size-5' />
        </Link>
        <h1 className='font-display text-3xl font-bold'>Your table</h1>
      </div>

      {orders === undefined ? (
        <div className='mt-6 space-y-4'>
          <Skeleton className='h-72 rounded-[28px]' />
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
        <div className='mt-6 space-y-4'>
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} onPay={() => setPayOrder(o)} onReceipt={() => setReceipt(o)} />
          ))}

          {outstanding > 0 && (
            <section aria-label='Table bill' className='rounded-[28px] bg-[#17171a] p-5 text-white'>
              <div className='flex items-end justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-white/70'>
                    {bill ? 'Bill requested — a server is on the way' : 'Open on your table'}
                  </p>
                  <p className='tabular font-display text-4xl font-bold'>{money(outstanding)}</p>
                </div>
                <span className='rounded-full bg-highlight px-3 py-1.5 text-xs font-bold text-on-highlight'>
                  {openCount} {openCount === 1 ? 'order' : 'orders'}
                </span>
              </div>
              {shares && (
                <p className='mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold'>
                  Split {bill!.people} ways · <span className='tabular text-highlight'>{money(shares[0])} each</span>
                </p>
              )}
            </section>
          )}

          <div className='pt-2 text-center'>
            <Link to={`/t/${tableId}`} className={buttonClasses({ variant: 'soft' })}>
              Order something else
            </Link>
          </div>
        </div>
      )}

      <div className='fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
        <div className='mx-auto flex max-w-md gap-2.5'>
          <button
            type='button'
            onClick={openAssistance}
            aria-label={assistance.length ? 'Help is on the way — call staff' : 'Call staff'}
            className={cn(
              'pressable flex size-16 shrink-0 items-center justify-center rounded-full shadow-raised',
              assistance.length ? 'bg-accent-soft text-accent-ink' : 'bg-surface text-ink',
            )}
          >
            <BellRing className='size-5' />
          </button>
          {outstanding > 0 && (
            <Button size='lg' className='h-16 flex-1 text-base' onClick={() => setBillOpen(true)}>
              {bill ? 'Change split' : 'Request the bill'}
            </Button>
          )}
        </div>
      </div>

      <PaySheet order={payOrder} onOpenChange={(o) => !o && setPayOrder(null)} onPaid={() => setPayOrder(null)} />
      <ReceiptDialog order={receipt} onOpenChange={(o) => !o && setReceipt(null)} />
      <BillSheet open={billOpen} onOpenChange={setBillOpen} outstandingCents={outstanding} current={bill} />
    </main>
  );
}
