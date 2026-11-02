import { BellRing, ReceiptText, ScanLine, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import type { AssistanceRequest, Order, RestaurantTable } from '@shared/schemas';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConfig, useTableAssistance, useTableInfo, useTableOrders } from '@/lib/queries';
import { useRealtimeSubscription } from '@/lib/realtime';
import { getTableToken, rememberOrder, rememberedOrderIds, setTableToken } from '@/lib/tableSession';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Skeleton } from '@/ui/Display';
import { AssistanceSheet } from './AssistanceSheet';
import { ConnectionBanner } from './ConnectionBanner';

export interface DinerContext {
  tableId: string;
  token: string | null;
  canOrder: boolean;
  table: RestaurantTable;
  orders: Order[] | undefined;
  assistance: AssistanceRequest[];
  /** Remember an order this device placed so it stays visible after it completes. */
  trackOrder: (orderId: string) => void;
  openAssistance: () => void;
}

export const useDiner = () => useOutletContext<DinerContext>();

const roundButton =
  'pressable relative inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card transition-colors hover:bg-surface-2';

export function DinerLayout() {
  const { tableId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => params.get('k') ?? getTableToken(tableId));
  const [assistOpen, setAssistOpen] = useState(false);

  // Move the token from the QR link into storage, then tidy the URL.
  useEffect(() => {
    const k = params.get('k');
    if (!k) return;
    setTableToken(tableId, k);
    setToken(k);
    const next = new URLSearchParams(params);
    next.delete('k');
    navigate({ search: next.toString() }, { replace: true });
  }, [params, tableId, navigate]);

  const { data: config } = useConfig();
  const info = useTableInfo(tableId, token);
  const canOrder = !!info.data?.canOrder;
  const tableToken = canOrder ? token : null;
  useRealtimeSubscription(tableToken ? { type: 'subscribe', room: 'table', tableId, token: tableToken } : null);

  const [include, setInclude] = useState(() => rememberedOrderIds(tableId));
  const trackOrder = useCallback(
    (orderId: string) => {
      rememberOrder(tableId, orderId);
      setInclude(rememberedOrderIds(tableId));
    },
    [tableId],
  );
  const orders = useTableOrders(tableId, tableToken, include);
  const assistance = useTableAssistance(tableId, tableToken);
  const activeOrders = orders.data?.filter((o) => !['completed', 'cancelled'].includes(o.status)).length ?? 0;
  const hasAssistance = (assistance.data?.length ?? 0) > 0;

  if (info.error instanceof ApiError && info.error.status === 404) return <NotFoundPage message='We couldn’t find that table.' />;

  const table = info.data?.table;

  return (
    <div className='min-h-dvh bg-canvas'>
      <ScrollRestoration />
      <header className='sticky top-0 z-30 bg-canvas/85 backdrop-blur-xl'>
        <div className='mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6'>
          <Link to={`/t/${tableId}`} className='flex min-w-0 items-center gap-3'>
            <span className='flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent'>
              <UtensilsCrossed className='size-5' />
            </span>
            <span className='min-w-0'>
              <span className='block truncate text-xs font-semibold text-ink-muted'>{config?.restaurantName ?? ' '}</span>
              <span className='block font-display text-lg leading-tight font-bold'>
                {table ? table.label : <Skeleton className='mt-1 h-4 w-16' />}
              </span>
            </span>
          </Link>

          {canOrder ? (
            <nav className='flex items-center gap-2' aria-label='Table actions'>
              <Link
                to={`/t/${tableId}/orders`}
                aria-label={activeOrders > 0 ? `Your orders, ${activeOrders} in progress` : 'Your orders'}
                className={roundButton}
              >
                <ReceiptText className='size-5' />
                {activeOrders > 0 && (
                  <span className='tabular absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent ring-2 ring-canvas'>
                    {activeOrders}
                  </span>
                )}
              </Link>
              <button
                type='button'
                onClick={() => setAssistOpen(true)}
                aria-label={hasAssistance ? 'Help is on the way — call staff' : 'Call staff'}
                className={cn(roundButton, hasAssistance && 'bg-accent-soft text-accent-ink hover:bg-accent-soft')}
              >
                <BellRing className='size-5' />
                {hasAssistance && (
                  <span className='animate-pulse-ring absolute top-2.5 right-2.5 size-2 rounded-full bg-accent ring-2 ring-surface' />
                )}
              </button>
            </nav>
          ) : null}
        </div>
      </header>

      {info.isSuccess && !canOrder && (
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <div className='flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas'>
            <ScanLine className='size-5 shrink-0 text-highlight' />
            <p>
              You’re browsing the menu. <strong className='font-bold'>Scan the QR code on your table</strong> to order and pay
              from your phone.
            </p>
          </div>
        </div>
      )}

      <ConnectionBanner enabled={canOrder} />

      {table ? (
        <Outlet
          context={
            {
              tableId,
              token: tableToken,
              canOrder,
              table,
              orders: orders.data,
              assistance: assistance.data ?? [],
              trackOrder,
              openAssistance: () => setAssistOpen(true),
            } satisfies DinerContext
          }
        />
      ) : (
        <div className='mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6'>
          <Skeleton className='h-12 w-full rounded-full' />
          <Skeleton className='h-40 w-full rounded-3xl' />
          <Skeleton className='h-24 w-full' />
        </div>
      )}

      {canOrder && tableToken && (
        <AssistanceSheet
          open={assistOpen}
          onOpenChange={setAssistOpen}
          tableId={tableId}
          token={tableToken}
          active={assistance.data ?? []}
        />
      )}
    </div>
  );
}
