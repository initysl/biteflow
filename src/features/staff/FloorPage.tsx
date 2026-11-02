import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, CreditCard, HandPlatter, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { splitEvenly } from '@shared/money';
import { ASSISTANCE_LABELS, type Order, type TableWithToken } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useMoney, useStaffAssistance, useStaffOrders, useStaffTables } from '@/lib/queries';
import { relativeTime } from '@/lib/time';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Badge, Card, EmptyState, Skeleton } from '@/ui/Display';
import { PageHeader } from './StaffLayout';

const TABLE_TONE = {
  vacant: { label: 'Vacant', tone: 'neutral' },
  seated: { label: 'Seated', tone: 'info' },
  billing: { label: 'Bill requested', tone: 'warning' },
} as const;

function AttentionRow({ icon, title, meta, action }: { icon: ReactNode; title: ReactNode; meta: ReactNode; action: ReactNode }) {
  return (
    <li className='animate-arrive flex items-center gap-3 px-4 py-3'>
      <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink'>{icon}</span>
      <div className='min-w-0 flex-1'>
        <p className='font-medium'>{title}</p>
        <p className='text-sm text-ink-muted'>{meta}</p>
      </div>
      {action}
    </li>
  );
}

export function FloorPage() {
  const qc = useQueryClient();
  const money = useMoney();
  const tables = useStaffTables();
  const assistance = useStaffAssistance();
  const orders = useStaffOrders();
  const [settling, setSettling] = useState<TableWithToken | null>(null);

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
  const settle = useMutation({
    mutationFn: (tableId: string) => api<{ settled: number }>(`/staff/tables/${tableId}/settle`, { method: 'POST' }),
    onSuccess: (_res, tableId) => {
      qc.invalidateQueries({ queryKey: queryKeys.staffTables });
      qc.invalidateQueries({ queryKey: queryKeys.staffOrders });
      toast.success(`Table ${tableId} settled`);
      setSettling(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const ready = (orders.data ?? []).filter((o) => o.status === 'ready');
  const bills = (tables.data ?? []).filter((t) => t.billRequest);
  const requests = assistance.data ?? [];
  const attention = requests.length + bills.length + ready.length;
  const loading = tables.isLoading || assistance.isLoading || orders.isLoading;

  return (
    <div>
      <PageHeader title='Floor' description='Who needs what, right now.' />

      <div className='grid gap-6 px-4 pb-10 sm:px-8 xl:grid-cols-[minmax(0,420px)_1fr]'>
        <section aria-labelledby='attention-heading'>
          <h2 id='attention-heading' className='mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase'>
            Needs attention {attention > 0 && <span className='tabular text-accent'>· {attention}</span>}
          </h2>
          <Card className='overflow-hidden'>
            {loading ? (
              <div className='space-y-3 p-4'>
                <Skeleton className='h-12' />
                <Skeleton className='h-12' />
              </div>
            ) : attention === 0 ? (
              <EmptyState className='py-12' icon={<Check className='size-6' />} title='All caught up'>
                Help requests, bills and ready plates will show up here.
              </EmptyState>
            ) : (
              <ul className='divide-y divide-line'>
                {requests.map((r) => (
                  <AttentionRow
                    key={r.id}
                    icon={<BellRing className='size-5' />}
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
                    <AttentionRow
                      key={b.id}
                      icon={<CreditCard className='size-5' />}
                      title={`${t.label} wants the bill`}
                      meta={
                        <span className='tabular'>
                          {money(t.openTotalCents)}
                          {each !== null && ` · split ${b.people} ways (${money(each)} each)`} · {relativeTime(b.createdAt)}
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
                  <AttentionRow
                    key={o.id}
                    icon={<HandPlatter className='size-5' />}
                    title={`Run #${o.number} to table ${o.tableId}`}
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
          </Card>
        </section>

        <section aria-labelledby='tables-heading'>
          <h2 id='tables-heading' className='mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase'>
            Tables
          </h2>
          {tables.isLoading ? (
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4'>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className='h-36' />
              ))}
            </div>
          ) : (
            <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4'>
              {tables.data?.map((t) => {
                const meta = TABLE_TONE[t.status];
                const help = requests.some((r) => r.tableId === t.id);
                return (
                  <li key={t.id}>
                    <Card
                      className={cn(
                        'flex h-full flex-col p-4 transition-colors',
                        t.status === 'vacant' && 'bg-surface-2/40 shadow-none',
                        help && 'border-accent ring-1 ring-accent',
                      )}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <span className='font-display text-2xl font-semibold'>{t.id}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className='mt-1 flex items-center gap-1.5 text-sm text-ink-muted'>
                        <Users className='size-3.5' /> {t.seats} seats
                        {t.openOrderCount > 0 && ` · ${t.openOrderCount} open`}
                      </p>
                      <div className='mt-auto flex items-end justify-between gap-2 pt-4'>
                        <span className={cn('tabular font-medium', t.openTotalCents === 0 && 'text-ink-subtle')}>
                          {t.openTotalCents > 0 ? money(t.openTotalCents) : '—'}
                        </span>
                        {t.openTotalCents > 0 && (
                          <Button size='sm' variant={t.billRequest ? 'primary' : 'ghost'} onClick={() => setSettling(t)}>
                            Settle
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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
