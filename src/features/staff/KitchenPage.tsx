import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Clock, MessageSquareText, Undo2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KITCHEN_STATUSES, STATIONS, STATION_LABELS, type Order, type OrderStatus, type Station } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useStaffOrders } from '@/lib/queries';
import { minutesSince } from '@/lib/time';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Badge, EmptyState, Skeleton } from '@/ui/Display';
import { Chip } from '@/ui/Form';
import { PageHeader } from './StaffLayout';

type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

const COLUMNS: Record<KitchenStatus, { title: string; empty: string; next: OrderStatus; action: string; back?: OrderStatus }> = {
  pending: { title: 'New', empty: 'New tickets land here', next: 'preparing', action: 'Start' },
  preparing: { title: 'Preparing', empty: 'Nothing on the pass', next: 'ready', action: 'Mark ready', back: 'pending' },
  ready: { title: 'Ready to serve', empty: 'All plates are out', next: 'served', action: 'Served', back: 'preparing' },
};

const TONES = {
  ok: { head: 'bg-surface', border: 'border-transparent', timer: 'text-ink-muted' },
  warn: { head: 'bg-warning-soft', border: 'border-warning/40', timer: 'text-warning' },
  late: { head: 'bg-danger-soft', border: 'border-danger/40', timer: 'text-danger' },
};

// Card orders only reach the kitchen once paid, so their clock starts then.
const kitchenStart = (o: Order) => (o.paymentMethod === 'card' && o.paidAt ? o.paidAt : o.createdAt);

/** Re-render every 30s so ticket timers stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api<Order>(`/staff/orders/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (order) =>
      qc.setQueryData<Order[]>(queryKeys.staffOrders, (prev) => prev?.map((o) => (o.id === order.id ? order : o))),
    onError: (err) => toast.error(errorMessage(err)),
  });
}

function Ticket({ order, station, now }: { order: Order; station: Station | 'all'; now: number }) {
  const transition = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const col = COLUMNS[order.status as KitchenStatus];
  const mins = minutesSince(kitchenStart(order), now);
  const tone = TONES[mins >= 20 ? 'late' : mins >= 12 ? 'warn' : 'ok'];
  const items = station === 'all' ? order.items : order.items.filter((i) => i.station === station);
  const pendingFor = transition.isPending ? transition.variables?.status : undefined;

  return (
    <article
      className={cn('animate-arrive overflow-hidden rounded-[22px] border-[1.5px] bg-surface shadow-card', tone.border)}
      aria-label={`Order ${order.number}, table ${order.tableId}`}
    >
      <header className={cn('flex items-center justify-between gap-2 px-4 py-3', tone.head)}>
        <div className='flex items-baseline gap-2'>
          <span className='font-display text-2xl font-bold'>T{order.tableId}</span>
          <span className='tabular text-sm font-semibold text-ink-muted'>#{order.number}</span>
        </div>
        <span className={cn('tabular inline-flex items-center gap-1 text-sm font-extrabold', tone.timer)}>
          <Clock className='size-3.5' strokeWidth={2.6} />
          {mins}m
        </span>
      </header>

      <ul className='space-y-2.5 px-4 py-3.5'>
        {items.map((i) => (
          <li key={i.id} className='flex gap-3'>
            <span className='tabular flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-extrabold text-canvas'>
              {i.quantity}
            </span>
            <div className='min-w-0'>
              <p className='text-[15px] leading-7 font-bold'>{i.name}</p>
              {i.note && <p className='text-sm font-bold text-accent-text'>→ {i.note}</p>}
              {station === 'all' && <p className='text-xs font-medium text-ink-subtle'>{STATION_LABELS[i.station]}</p>}
            </div>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className='mx-4 mb-3.5 flex gap-2 rounded-2xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-ink'>
          <MessageSquareText className='mt-0.5 size-4 shrink-0' />
          {order.notes}
        </p>
      )}

      <footer className='flex items-center gap-2 border-t border-line px-3 py-3'>
        {col.back ? (
          <Button
            variant='ghost'
            size='icon'
            aria-label='Move back'
            title='Move back'
            loading={pendingFor === col.back}
            disabled={transition.isPending}
            onClick={() => transition.mutate({ id: order.id, status: col.back! })}
          >
            {pendingFor !== col.back && <Undo2 className='size-4.5' />}
          </Button>
        ) : (
          <Button
            variant='ghost'
            size='icon'
            aria-label='Cancel order'
            title='Cancel order'
            disabled={transition.isPending}
            onClick={() => setConfirmCancel(true)}
          >
            <X className='size-4.5' />
          </Button>
        )}
        <Badge tone={order.paymentStatus === 'paid' ? 'success' : 'neutral'}>
          {order.paymentStatus === 'paid' ? 'Paid' : 'Tab'}
        </Badge>
        <Button
          className='ml-auto'
          variant={order.status === 'ready' ? 'dark' : 'primary'}
          loading={pendingFor === col.next}
          disabled={transition.isPending}
          onClick={() => transition.mutate({ id: order.id, status: col.next })}
        >
          {col.action}
        </Button>
      </footer>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel order #${order.number}?`}
        confirmLabel='Cancel order'
        tone='danger'
        loading={pendingFor === 'cancelled'}
        onConfirm={() => transition.mutate({ id: order.id, status: 'cancelled' }, { onSuccess: () => setConfirmCancel(false) })}
      >
        Table {order.tableId} will see the order as cancelled. This can’t be undone.
      </ConfirmDialog>
    </article>
  );
}

export function KitchenPage() {
  const { data: orders, isLoading } = useStaffOrders();
  const [station, setStation] = useState<Station | 'all'>('all');
  const [mobileColumn, setMobileColumn] = useState<KitchenStatus>('pending');
  const now = useNow();

  const byColumn = Object.fromEntries(
    KITCHEN_STATUSES.map((s) => [
      s,
      (orders ?? [])
        .filter((o) => o.status === s && (station === 'all' || o.items.some((i) => i.station === station)))
        .sort((a, b) => Date.parse(kitchenStart(a)) - Date.parse(kitchenStart(b))),
    ]),
  ) as Record<KitchenStatus, Order[]>;

  return (
    <div className='flex min-h-dvh flex-col'>
      <PageHeader
        section='Service'
        title='Kitchen'
        description='Oldest tickets first. Timers turn amber at 12 minutes and red at 20.'
        actions={
          <div className='flex flex-wrap gap-2' role='group' aria-label='Filter by station'>
            <Chip selected={station === 'all'} onClick={() => setStation('all')}>
              All stations
            </Chip>
            {STATIONS.map((s) => (
              <Chip key={s} selected={station === s} onClick={() => setStation(s)}>
                {STATION_LABELS[s]}
              </Chip>
            ))}
          </div>
        }
      />

      {/* Column switcher on phones */}
      <div className='grid grid-cols-3 gap-1.5 px-4 pb-4 lg:hidden'>
        {KITCHEN_STATUSES.map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => setMobileColumn(s)}
            aria-pressed={mobileColumn === s}
            className={cn(
              'pressable h-11 rounded-full text-sm font-bold transition-colors',
              mobileColumn === s ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted shadow-card',
            )}
          >
            {COLUMNS[s].title.split(' ')[0]} <span className='tabular opacity-75'>{byColumn[s].length}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className='grid gap-5 px-4 sm:px-8 lg:grid-cols-3'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-80 rounded-[28px]' />
          ))}
        </div>
      ) : (
        <div className='grid flex-1 gap-5 px-4 pb-8 sm:px-8 lg:grid-cols-3'>
          {KITCHEN_STATUSES.map((s) => (
            <section
              key={s}
              aria-labelledby={`col-${s}`}
              className={cn('min-w-0 rounded-[28px] bg-surface-3/60 p-3', mobileColumn !== s && 'hidden lg:block')}
            >
              <h2
                id={`col-${s}`}
                className='flex items-center justify-between px-2 pt-1 pb-3 text-[13px] font-extrabold tracking-[0.06em] text-ink-muted uppercase'
              >
                {COLUMNS[s].title}
                <span className='tabular rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink'>{byColumn[s].length}</span>
              </h2>
              <div className='space-y-3'>
                {byColumn[s].length === 0 ? (
                  <EmptyState className='py-10' icon={<ChefHat className='size-6' />} title={COLUMNS[s].empty} />
                ) : (
                  byColumn[s].map((o) => <Ticket key={o.id} order={o} station={station} now={now} />)
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
