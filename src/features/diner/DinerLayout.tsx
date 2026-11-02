import { BellRing, ReceiptText, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router';
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
      <header className='sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-xl'>
        <div className='mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6'>
          <Link to={`/t/${tableId}`} className='min-w-0'>
            <span className='block truncate font-display text-lg leading-tight font-semibold'>
              {config?.restaurantName ?? ' '}
            </span>
            <span className='block text-xs text-ink-muted'>{table ? table.label : <Skeleton className='mt-0.5 h-3 w-14' />}</span>
          </Link>

          {canOrder ? (
            <nav className='flex items-center gap-1.5' aria-label='Table actions'>
              <button
                type='button'
                onClick={() => setAssistOpen(true)}
                aria-label={hasAssistance ? 'Help is on the way — call staff' : 'Call staff'}
                className={cn(
                  'pressable relative inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors',
                  hasAssistance ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <BellRing className='size-4' />
                <span className='hidden sm:inline'>{hasAssistance ? 'Help on the way' : 'Call staff'}</span>
                {hasAssistance && (
                  <span className='absolute top-1.5 right-1.5 size-2 rounded-full bg-accent animate-pulse-ring sm:hidden' />
                )}
              </button>
              <NavLink
                to={`/t/${tableId}/orders`}
                aria-label={activeOrders > 0 ? `Your orders, ${activeOrders} in progress` : 'Your orders'}
                className={({ isActive }) =>
                  cn(
                    'pressable relative inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                <ReceiptText className='size-4' />
                <span className='hidden sm:inline'>Your orders</span>
                {activeOrders > 0 && (
                  <span className='tabular inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent'>
                    {activeOrders}
                  </span>
                )}
              </NavLink>
            </nav>
          ) : null}
        </div>
      </header>

      {info.isSuccess && !canOrder && (
        <div className='border-b border-line bg-surface-2'>
          <div className='mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 text-sm text-ink-muted sm:px-6'>
            <ScanLine className='size-5 shrink-0 text-accent' />
            <p>
              You’re browsing the menu. <strong className='font-medium text-ink'>Scan the QR code on your table</strong> to order
              and pay from your phone.
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
        <div className='mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6'>
          <Skeleton className='h-10 w-2/3' />
          <Skeleton className='h-5 w-1/2' />
          <Skeleton className='mt-8 h-36 w-full' />
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
