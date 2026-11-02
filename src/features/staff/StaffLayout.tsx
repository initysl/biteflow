import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  ChefHat,
  ExternalLink,
  LayoutGrid,
  LogOut,
  QrCode,
  RotateCcw,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { toast } from 'sonner';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConfig, useMe, useStaffAssistance, useStaffOrders, useStaffTables } from '@/lib/queries';
import { realtime, useConnectionStatus, useRealtimeSubscription } from '@/lib/realtime';
import { playChime } from '@/lib/sound';
import { Button } from '@/ui/Button';
import { Skeleton, StatusDot } from '@/ui/Display';
import { Dialog } from '@/ui/Sheet';
import { ThemeToggle } from '@/ui/ThemeToggle';

const SOUND_KEY = 'bf:staff:sound';

function useSoundPref() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, [on]);
  return [on, setOn] as const;
}

/** Chime + announcement when a new ticket or help request arrives. */
function useAlerts(soundOn: boolean) {
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const [announcement, setAnnouncement] = useState('');

  useEffect(
    () =>
      realtime.on((event) => {
        if (event.type === 'order.upserted' && event.order.status === 'pending' && !event.order.preparingAt) {
          const age = Date.now() - Date.parse(event.order.paidAt ?? event.order.createdAt);
          if (age > 10_000) return; // an edit to an old ticket, not a new one
          if (soundRef.current) playChime();
          setAnnouncement(`New order ${event.order.number} for table ${event.order.tableId}`);
          toast(`New order #${event.order.number}`, {
            description: `Table ${event.order.tableId} · ${event.order.items.length} items`,
          });
        }
      }),
    [],
  );
  return announcement;
}

const NAV = [
  { to: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { to: 'floor', label: 'Floor', icon: LayoutGrid },
  { to: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { to: 'tables', label: 'Tables & QR', icon: QrCode },
  { to: 'reports', label: 'Reports', icon: BarChart3 },
] as const;

function NavBadge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'danger' }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
        tone === 'danger' ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent',
      )}
    >
      {count}
    </span>
  );
}

export function StaffLayout() {
  const me = useMe();
  const location = useLocation();
  const qc = useQueryClient();
  const { data: config } = useConfig();
  const [soundOn, setSoundOn] = useSoundPref();
  const [resetOpen, setResetOpen] = useState(false);
  const status = useConnectionStatus();
  const signedIn = me.isSuccess;
  useRealtimeSubscription(signedIn ? { type: 'subscribe', room: 'staff' } : null);
  const announcement = useAlerts(soundOn);

  const orders = useStaffOrders(signedIn);
  const assistance = useStaffAssistance(signedIn);
  const tables = useStaffTables(signedIn);
  // Chime when a help request is added (not when one is resolved).
  const assistCount = assistance.data?.length;
  const prevAssist = useRef(assistCount);
  useEffect(() => {
    if (assistCount !== undefined && prevAssist.current !== undefined && assistCount > prevAssist.current && soundOn) playChime();
    prevAssist.current = assistCount;
  }, [assistCount, soundOn]);

  const newCount = orders.data?.filter((o) => o.status === 'pending').length ?? 0;
  const floorCount = (assistance.data?.length ?? 0) + (tables.data?.filter((t) => t.billRequest).length ?? 0);

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      window.location.assign('/staff/login');
    },
  });
  const reset = useMutation({
    mutationFn: () => api('/staff/demo/reset', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries();
      setResetOpen(false);
      toast.success('Demo data restored');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to='/staff/login' replace state={{ from: location.pathname }} />;
  }
  if (!signedIn) {
    return (
      <div className='grid min-h-dvh place-items-center bg-canvas'>
        <Skeleton className='h-10 w-40' />
      </div>
    );
  }

  const counts: Record<string, number> = { kitchen: newCount, floor: floorCount };

  return (
    <div className='min-h-dvh bg-canvas md:grid md:grid-cols-[232px_1fr]'>
      <ScrollRestoration />
      <p className='sr-only' aria-live='assertive'>
        {announcement}
      </p>

      {/* Sidebar (tablet & desktop) */}
      <aside className='sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 md:flex'>
        <Link to='/' className='flex items-center gap-2.5 px-2.5'>
          <img src='/bitflow.svg' alt='' className='size-7' />
          <span className='min-w-0'>
            <span className='block font-display text-lg leading-tight font-semibold'>BiteFlow</span>
            <span className='block truncate text-xs text-ink-subtle'>{config?.restaurantName}</span>
          </span>
        </Link>
        <nav className='mt-8 space-y-0.5' aria-label='Staff'>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink',
                )
              }
            >
              <Icon className='size-4.5' />
              {label}
              <NavBadge count={counts[to] ?? 0} tone={to === 'floor' ? 'danger' : 'accent'} />
            </NavLink>
          ))}
        </nav>

        <div className='mt-auto space-y-1 border-t border-line pt-4'>
          <div className='flex items-center gap-2 px-3 py-1.5 text-sm text-ink-muted'>
            <StatusDot
              tone={status === 'online' ? 'success' : status === 'connecting' ? 'warning' : 'danger'}
              pulse={status !== 'online'}
            />
            {status === 'online' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline — retrying'}
          </div>
          {config?.demoMode && (
            <button
              type='button'
              onClick={() => setResetOpen(true)}
              className='flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
            >
              <RotateCcw className='size-4' /> Reset demo data
            </button>
          )}
          <a
            href='/'
            target='_blank'
            rel='noreferrer'
            className='flex h-9 items-center gap-3 rounded-xl px-3 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
          >
            <ExternalLink className='size-4' /> Guest view
          </a>
          <div className='flex items-center justify-between gap-1 px-1 pt-2'>
            <span className='truncate px-2 text-sm font-medium'>{me.data.name}</span>
            <div className='flex'>
              <button
                type='button'
                onClick={() => setSoundOn(!soundOn)}
                aria-label={soundOn ? 'Mute alerts' : 'Unmute alerts'}
                title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
                className='pressable inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink'
              >
                {soundOn ? <Volume2 className='size-4.5' /> : <VolumeX className='size-4.5' />}
              </button>
              <ThemeToggle />
              <button
                type='button'
                onClick={() => logout.mutate()}
                aria-label='Sign out'
                title='Sign out'
                className='pressable inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink'
              >
                <LogOut className='size-4.5' />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Top bar (phones) */}
      <header className='sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-xl md:hidden'>
        <span className='flex items-center gap-2'>
          <img src='/bitflow.svg' alt='' className='size-6' />
          <span className='font-display font-semibold'>BiteFlow</span>
          <StatusDot tone={status === 'online' ? 'success' : 'warning'} pulse={status !== 'online'} />
        </span>
        <div className='flex items-center'>
          <button
            type='button'
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? 'Mute alerts' : 'Unmute alerts'}
            className='pressable inline-flex size-9 items-center justify-center rounded-lg text-ink-muted'
          >
            {soundOn ? <Volume2 className='size-4.5' /> : <VolumeX className='size-4.5' />}
          </button>
          <ThemeToggle />
          <button
            type='button'
            onClick={() => logout.mutate()}
            aria-label='Sign out'
            className='pressable inline-flex size-9 items-center justify-center rounded-lg text-ink-muted'
          >
            <LogOut className='size-4.5' />
          </button>
        </div>
      </header>

      <div className='min-w-0 pb-24 md:pb-0'>
        <Outlet />
      </div>

      {/* Bottom tabs (phones) */}
      <nav
        aria-label='Staff'
        className='fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden'
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-ink-subtle',
              )
            }
          >
            <Icon className='size-5' />
            {label.split(' ')[0]}
            {(counts[to] ?? 0) > 0 && <span className='absolute top-2.5 right-[calc(50%-18px)] size-2 rounded-full bg-danger' />}
          </NavLink>
        ))}
      </nav>

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title='Reset demo data?'
        description='Clears all orders and requests, restores the sample menu and adds a few example tickets.'
        footer={
          <>
            <Button variant='ghost' onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant='danger' loading={reset.isPending} onClick={() => reset.mutate()}>
              Reset
            </Button>
          </>
        }
      >
        <p className='text-sm text-ink-muted'>Tables, QR codes and staff accounts are kept.</p>
      </Dialog>
    </div>
  );
}

/** Shared page header for staff screens. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className='flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-5 sm:px-8 sm:pt-8'>
      <div>
        <h1 className='font-display text-3xl font-semibold tracking-tight'>{title}</h1>
        {description && <p className='mt-1 text-ink-muted'>{description}</p>}
      </div>
      {actions && <div className='flex flex-wrap gap-2'>{actions}</div>}
    </div>
  );
}
