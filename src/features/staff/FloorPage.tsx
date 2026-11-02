import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, CreditCard, HandPlatter, Users } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { splitEvenly } from '@shared/money';
import { ASSISTANCE_LABELS, OPEN_STATUSES, type Order, type TableWithToken } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ORDER_STATUS_META } from '@/lib/orderStatus';
import { queryKeys, useMenu, useMoney, useStaffAssistance, useStaffOrders, useStaffTables } from '@/lib/queries';
import { clockTime, minutesSince, relativeTime } from '@/lib/time';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Badge, EmptyState, FoodImage, Skeleton } from '@/ui/Display';
import { Chip } from '@/ui/Form';
import { PageHeader } from './StaffLayout';

type Filter = 'all' | 'seated' | 'billing' | 'vacant';

const STATUS_PILL = {
  vacant: { label: 'Vacant', tone: 'neutral' },
  seated: { label: 'Seated', tone: 'info' },
  billing: { label: 'Bill requested', tone: 'highlight' },
} as const;

function AttentionCard({
  icon,
  iconClass,
  title,
  meta,
  action,
}: {
  icon: ReactNode;
  iconClass: string;
  title: ReactNode;
  meta: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className='animate-arrive flex items-center gap-3 rounded-[22px] bg-surface p-3.5 shadow-card'>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', iconClass)}>{icon}</span>
      <div className='min-w-0 flex-1'>
        <p className='line-clamp-2 leading-snug font-bold'>{title}</p>
        <p className='truncate text-sm text-ink-muted'>{meta}</p>
      </div>
      {action}
    </li>
  );
}

function useSettle(onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => api<{ settled: number }>(`/staff/tables/${tableId}/settle`, { method: 'POST' }),
    onSuccess: (_res, tableId) => {
      qc.invalidateQueries({ queryKey: queryKeys.staffTables });
      qc.invalidateQueries({ queryKey: queryKeys.staffOrders });
      toast.success(`Table ${tableId} settled`);
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

function TablePanel({
  table,
  orders,
  onSettle,
  onServe,
  serving,
}: {
  table: TableWithToken | undefined;
  orders: Order[];
  onSettle: () => void;
  onServe: (id: string) => void;
  serving: string | undefined;
}) {
  const money = useMoney();
  const { data: menu } = useMenu();
  if (!table) {
    return (
      <EmptyState className='py-16' icon={<Users className='size-6' />} title='Pick a table'>
        Select a table to see its orders and take payment.
      </EmptyState>
    );
  }
  const subtotal = orders.reduce((s, o) => s + o.subtotalCents, 0);
  const discount = orders.reduce((s, o) => s + o.discountCents, 0);
  const promo = orders.find((o) => o.promoCode)?.promoCode;
  const bill = table.billRequest;
  const shares = bill?.split === 'even' ? splitEvenly(table.openTotalCents, bill.people) : null;
  const seatedFor = orders.length ? minutesSince(orders[orders.length - 1].createdAt) : null;
  const pill = STATUS_PILL[table.status];

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-bold text-ink-muted'>
            {table.seats} seats{seatedFor !== null && ` · seated ${seatedFor} min`}
          </p>
          <h2 className='mt-0.5 font-display text-2xl font-bold'>{table.label}</h2>
        </div>
        <Badge tone={pill.tone}>{pill.label}</Badge>
      </div>

      {orders.length === 0 ? (
        <p className='rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-muted'>No open orders on this table.</p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {orders.map((o) => (
            <li key={o.id} className='rounded-2xl bg-surface-2 p-3'>
              <div className='flex items-center justify-between gap-2 px-1 pb-2'>
                <span className='text-xs font-bold text-ink-muted'>
                  #{o.number} · {clockTime(o.createdAt)}
                </span>
                {o.status === 'ready' ? (
                  <Button size='sm' variant='dark' loading={serving === o.id} onClick={() => onServe(o.id)}>
                    Mark served
                  </Button>
                ) : (
                  <Badge tone={ORDER_STATUS_META[o.status].tone}>{ORDER_STATUS_META[o.status].label}</Badge>
                )}
              </div>
              <ul className='flex flex-col gap-2'>
                {o.items.map((i) => (
                  <li key={i.id} className='flex items-center gap-3 rounded-xl bg-surface p-2'>
                    <FoodImage
                      src={menu?.find((m) => m.id === i.menuItemId)?.imageUrl ?? null}
                      alt={i.name}
                      className='size-11 shrink-0 rounded-xl'
                    />
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-bold'>{i.name}</p>
                      <p className='tabular text-sm font-bold text-accent-text'>
                        {money(i.unitPriceCents)} × {i.quantity} = {money(i.unitPriceCents * i.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {o.paymentStatus === 'paid' && <p className='px-1 pt-2 text-xs font-bold text-success'>Paid by card</p>}
            </li>
          ))}
        </ul>
      )}

      <dl className='flex flex-col gap-2 border-t border-dashed border-line-strong pt-4 text-sm'>
        <div className='flex justify-between'>
          <dt className='text-ink-muted'>Subtotal</dt>
          <dd className='tabular font-bold'>{money(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className='flex justify-between'>
            <dt className='text-ink-muted'>Promo{promo && ` (${promo})`}</dt>
            <dd className='tabular font-bold text-success'>−{money(discount)}</dd>
          </div>
        )}
        {shares && (
          <div className='flex justify-between'>
            <dt className='text-ink-muted'>Split</dt>
            <dd className='tabular font-bold'>
              {bill!.people} ways · {money(shares[0])} each
            </dd>
          </div>
        )}
        <div className='flex justify-between pt-1 font-display text-xl font-bold'>
          <dt>Left to pay</dt>
          <dd className='tabular'>{money(table.openTotalCents)}</dd>
        </div>
      </dl>

      <Button size='lg' disabled={table.openTotalCents === 0} onClick={onSettle}>
        <CreditCard className='size-4.5' /> Take payment
      </Button>
    </div>
  );
}

export function FloorPage() {
  const qc = useQueryClient();
  const money = useMoney();
  const tables = useStaffTables();
  const assistance = useStaffAssistance();
  const orders = useStaffOrders();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settling, setSettling] = useState<TableWithToken | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const resolve = useMutation({
    mutationFn: (id: string) => api(`/staff/assistance/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staffAssistance }),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const serve = useMutation({
    mutationFn: (id: string) => api<Order>(`/staff/orders/${id}`, { method: 'PATCH', body: { status: 'served' } }),
    onSuccess: (order) =>
      qc.setQueryData<Order[]>(queryKeys.staffOrders, (prev) => prev?.map((o) => (o.id === order.id ? order : o))),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const settle = useSettle(() => setSettling(null));

  const allTables = tables.data ?? [];
  const ready = (orders.data ?? []).filter((o) => o.status === 'ready');
  const bills = allTables.filter((t) => t.billRequest);
  const requests = assistance.data ?? [];
  const attention = requests.length + bills.length + ready.length;
  const loading = tables.isLoading || assistance.isLoading || orders.isLoading;

  const counts = {
    all: allTables.length,
    seated: allTables.filter((t) => t.status === 'seated').length,
    billing: bills.length,
    vacant: allTables.filter((t) => t.status === 'vacant').length,
  };
  const shown = filter === 'all' ? allTables : allTables.filter((t) => t.status === filter);
  const fallback = bills[0] ?? allTables.find((t) => t.status === 'seated');
  const selected = allTables.find((t) => t.id === selectedId) ?? fallback;
  const selectedOrders = selected
    ? (orders.data ?? []).filter(
        (o) => o.tableId === selected.id && OPEN_STATUSES.includes(o.status) && o.status !== 'awaiting_payment',
      )
    : [];

  const select = (id: string) => {
    setSelectedId(id);
    // When the panel sits below the grid (narrow screens), bring it into view.
    const top = panelRef.current?.getBoundingClientRect().top ?? 0;
    if (top > window.innerHeight * 0.6) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <PageHeader title='Floor' description='Who needs what, right now.' />

      <div className='flex flex-wrap items-start gap-6 px-4 pb-10 sm:px-6 lg:px-8'>
        <div className='@container flex min-w-0 flex-[999_1_560px] flex-col gap-6'>
          <section aria-labelledby='attention-heading'>
            <h2 id='attention-heading' className='mb-3 text-[13px] font-extrabold tracking-[0.06em] text-ink-muted uppercase'>
              Needs attention {attention > 0 && <span className='tabular text-accent-text'>· {attention}</span>}
            </h2>
            {loading ? (
              <div className='grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3'>
                <Skeleton className='h-[72px]' />
                <Skeleton className='h-[72px]' />
              </div>
            ) : attention === 0 ? (
              <div className='flex items-center gap-3 rounded-[22px] bg-surface p-4 text-sm text-ink-muted shadow-card'>
                <span className='flex size-10 items-center justify-center rounded-2xl bg-success-soft text-success'>
                  <Check className='size-5' strokeWidth={2.6} />
                </span>
                All caught up. Help requests, bills and ready plates will show up here.
              </div>
            ) : (
              <ul className='grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3'>
                {requests.map((r) => (
                  <AttentionCard
                    key={r.id}
                    icon={<BellRing className='size-5' />}
                    iconClass='bg-accent-soft text-accent-ink'
                    title={`Table ${r.tableId} · ${ASSISTANCE_LABELS[r.type]}`}
                    meta={relativeTime(r.createdAt)}
                    action={
                      <Button
                        size='sm'
                        variant='secondary'
                        loading={resolve.isPending && resolve.variables === r.id}
                        onClick={() => resolve.mutate(r.id)}
                      >
                        Done
                      </Button>
                    }
                  />
                ))}
                {bills.map((t) => {
                  const b = t.billRequest!;
                  const each = b.split === 'even' ? splitEvenly(t.openTotalCents, b.people)[0] : null;
                  return (
                    <AttentionCard
                      key={b.id}
                      icon={<CreditCard className='size-5' />}
                      iconClass='bg-highlight text-on-highlight'
                      title={`${t.label} wants the bill`}
                      meta={
                        <span className='tabular'>
                          {money(t.openTotalCents)}
                          {each !== null && ` · ${b.people} × ${money(each)}`}
                        </span>
                      }
                      action={
                        <Button size='sm' onClick={() => setSettling(t)}>
                          Take payment
                        </Button>
                      }
                    />
                  );
                })}
                {ready.map((o) => (
                  <AttentionCard
                    key={o.id}
                    icon={<HandPlatter className='size-5' />}
                    iconClass='bg-success-soft text-success'
                    title={
                      o.type === 'takeaway'
                        ? `Hand #${o.number} to ${o.customerName ?? 'takeaway'}`
                        : `Run #${o.number} to table ${o.tableId}`
                    }
                    meta={`${o.items.reduce((n, i) => n + i.quantity, 0)} items · ready ${relativeTime(o.readyAt ?? o.createdAt)}`}
                    action={
                      <Button
                        size='sm'
                        variant='secondary'
                        loading={serve.isPending && serve.variables === o.id}
                        onClick={() => serve.mutate(o.id)}
                      >
                        Served
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby='tables-heading'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
              <h2 id='tables-heading' className='text-[13px] font-extrabold tracking-[0.06em] text-ink-muted uppercase'>
                Tables
              </h2>
              <div role='group' aria-label='Filter tables' className='flex flex-wrap gap-2'>
                {(
                  [
                    ['all', 'All'],
                    ['seated', 'Seated'],
                    ['billing', 'Bill requested'],
                    ['vacant', 'Vacant'],
                  ] as const
                ).map(([value, label]) => (
                  <Chip key={value} tone='accent' selected={filter === value} onClick={() => setFilter(value)}>
                    {label} <span className='tabular opacity-75'>{counts[value]}</span>
                  </Chip>
                ))}
              </div>
            </div>
            {tables.isLoading ? (
              <div className='grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-4'>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className='h-32' />
                ))}
              </div>
            ) : (
              <ul className='grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-4'>
                {shown.map((t) => {
                  const pill = STATUS_PILL[t.status];
                  const help = requests.some((r) => r.tableId === t.id);
                  const isSelected = selected?.id === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type='button'
                        onClick={() => select(t.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'pressable flex h-full w-full flex-col items-start gap-1 rounded-[22px] p-4 text-left transition-[border-color,box-shadow]',
                          isSelected
                            ? 'border-2 border-accent bg-surface shadow-glow'
                            : t.status === 'vacant'
                              ? 'border-[1.5px] border-dashed border-line-strong'
                              : 'border-[1.5px] border-transparent bg-surface shadow-card',
                        )}
                      >
                        <span className='flex w-full items-start justify-between gap-2'>
                          <span className='font-display text-3xl leading-none font-bold'>{t.id}</span>
                          <Badge tone={help ? 'accent' : pill.tone}>{help ? 'Needs help' : pill.label}</Badge>
                        </span>
                        <span className='text-xs font-semibold text-ink-muted'>
                          {t.seats} seats{t.openOrderCount > 0 && ` · ${t.openOrderCount} open`}
                        </span>
                        <span
                          className={cn(
                            'tabular mt-3 font-display text-lg font-bold',
                            t.openTotalCents === 0 && 'text-ink-subtle',
                          )}
                        >
                          {t.openTotalCents > 0 ? money(t.openTotalCents) : '—'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside
          ref={panelRef}
          aria-label={selected ? `${selected.label} details` : 'Table details'}
          className='w-full scroll-mt-20 rounded-[28px] bg-surface p-5 shadow-card @5xl:sticky @5xl:top-20 @5xl:max-h-[calc(100dvh-6rem)] @5xl:w-auto @5xl:flex-[1_1_340px] @5xl:overflow-y-auto @5xl:overscroll-contain'
        >
          <TablePanel
            table={selected}
            orders={selectedOrders}
            onSettle={() => selected && setSettling(selected)}
            onServe={(id) => serve.mutate(id)}
            serving={serve.isPending ? serve.variables : undefined}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={!!settling}
        onOpenChange={(o) => !o && setSettling(null)}
        title={settling ? `Settle ${settling.label}?` : ''}
        confirmLabel={settling ? `Mark ${money(settling.openTotalCents)} as paid` : 'Confirm'}
        loading={settle.isPending}
        onConfirm={() => settling && settle.mutate(settling.id)}
      >
        Take payment at the table first. Confirming marks every open order on this table as paid and clears the bill request.
      </ConfirmDialog>
    </div>
  );
}
