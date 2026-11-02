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
  type LucideIcon,
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

/** Chime + announcement when a new ticket arrives. */
function useNewOrderAlerts(soundOn: boolean) {
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const [announcement, setAnnouncement] = useState('');

  useEffect(
    () =>
      realtime.on((event) => {
        if (event.type !== 'order.upserted' || event.order.status !== 'pending' || event.order.preparingAt) return;
        const age = Date.now() - Date.parse(event.order.paidAt ?? event.order.createdAt);
        if (age > 10_000) return; // an edit to an old ticket, not a new one
        if (soundRef.current) playChime();
        setAnnouncement(`New order ${event.order.number} for table ${event.order.tableId}`);
        toast(`New order #${event.order.number}`, {
          description: `Table ${event.order.tableId} · ${event.order.items.length} items`,
        });
      }),
    [],
  );
  return announcement;
}

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  group: 'Service' | 'Back office';
}

const NAV: NavItem[] = [
  { to: 'kitchen', label: 'Kitchen', short: 'Kitchen', icon: ChefHat, group: 'Service' },
  { to: 'floor', label: 'Floor', short: 'Floor', icon: LayoutGrid, group: 'Service' },
  { to: 'menu', label: 'Menu', short: 'Menu', icon: UtensilsCrossed, group: 'Back office' },
  { to: 'tables', label: 'Tables & QR', short: 'Tables', icon: QrCode, group: 'Back office' },
  { to: 'reports', label: 'Reports', short: 'Reports', icon: BarChart3, group: 'Back office' },
];

const iconButton =
  'pressable inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink';

function CountBadge({ count, tone }: { count: number; tone: 'accent' | 'ink' }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-ink text-canvas',
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
  const announcement = useNewOrderAlerts(soundOn);

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

  const counts: Record<string, { count: number; tone: 'accent' | 'ink' }> = {
    kitchen: { count: newCount, tone: 'accent' },
    floor: { count: floorCount, tone: 'ink' },
  };
  const initials = me.data.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const live = status === 'online';

  return (
    <div className='min-h-dvh bg-canvas md:grid md:grid-cols-[256px_1fr]'>
      <ScrollRestoration />
      <p className='sr-only' aria-live='assertive'>
        {announcement}
      </p>

      {/* Sidebar (tablet & desktop) */}
      <aside className='sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-4 py-6 md:flex'>
        <Link to='/' className='flex items-center gap-2.5 px-2'>
          <span className='flex size-10 items-center justify-center rounded-xl bg-accent text-on-accent'>
            <UtensilsCrossed className='size-5' />
          </span>
          <span className='font-display text-xl font-bold'>BiteFlow</span>
        </Link>

        <div className='flex items-center gap-3 rounded-2xl bg-surface-2 p-3'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-canvas'>
            {initials}
          </span>
          <span className='min-w-0'>
            <span className='block truncate text-sm font-bold'>{me.data.name}</span>
            <span className='block truncate text-xs text-ink-muted'>{config?.restaurantName}</span>
          </span>
        </div>

        <nav className='flex flex-col gap-1' aria-label='Staff'>
          {(['Service', 'Back office'] as const).map((group) => (
            <div key={group} className='flex flex-col gap-1'>
              <p
                className={cn(
                  'px-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-ink-subtle uppercase',
                  group === 'Back office' && 'pt-4',
                )}
              >
                {group}
              </p>
              {NAV.filter((n) => n.group === group).map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                      isActive
                        ? 'bg-accent-soft font-bold text-accent-ink'
                        : 'font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  <Icon className='size-4.5' />
                  {label}
                  {counts[to] && <CountBadge {...counts[to]} />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className='mt-auto space-y-1'>
          <div
            className={cn('flex items-center gap-2 px-3 py-1.5 text-sm font-semibold', live ? 'text-success' : 'text-warning')}
          >
            <StatusDot tone={live ? 'success' : 'warning'} pulse={!live} />
            {live ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline — retrying'}
          </div>
          {config?.demoMode && (
            <button
              type='button'
              onClick={() => setResetOpen(true)}
              className='flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
            >
              <RotateCcw className='size-4' /> Reset demo data
            </button>
          )}
          <a
            href='/'
            target='_blank'
            rel='noreferrer'
            className='flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
          >
            <ExternalLink className='size-4' /> Guest view
          </a>
          <div className='flex items-center gap-1 border-t border-line px-1 pt-3'>
            <button
              type='button'
              onClick={() => setSoundOn(!soundOn)}
              aria-label={soundOn ? 'Mute alerts' : 'Unmute alerts'}
              title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
              className={iconButton}
            >
              {soundOn ? <Volume2 className='size-4.5' /> : <VolumeX className='size-4.5' />}
            </button>
            <ThemeToggle />
            <button
              type='button'
              onClick={() => logout.mutate()}
              aria-label='Sign out'
              title='Sign out'
              className={cn(iconButton, 'ml-auto')}
            >
              <LogOut className='size-4.5' />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (phones) */}
      <header className='sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-xl md:hidden'>
        <span className='flex items-center gap-2'>
          <span className='flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent'>
            <UtensilsCrossed className='size-4' />
          </span>
          <span className='font-display font-bold'>BiteFlow</span>
          <StatusDot tone={live ? 'success' : 'warning'} pulse={!live} />
        </span>
        <div className='flex items-center'>
          <button
            type='button'
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? 'Mute alerts' : 'Unmute alerts'}
            className={iconButton}
          >
            {soundOn ? <Volume2 className='size-4.5' /> : <VolumeX className='size-4.5' />}
          </button>
          <ThemeToggle />
          <button type='button' onClick={() => logout.mutate()} aria-label='Sign out' className={iconButton}>
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
        {NAV.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold',
                isActive ? 'text-accent-text' : 'text-ink-subtle',
              )
            }
          >
            <Icon className='size-5' />
            {short}
            {(counts[to]?.count ?? 0) > 0 && (
              <span className='absolute top-2.5 right-[calc(50%-18px)] size-2 rounded-full bg-accent' />
            )}
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

/** Shared page header for staff screens: breadcrumb, title, optional actions. */
export function PageHeader({
  section,
  title,
  description,
  actions,
}: {
  section?: 'Service' | 'Back office';
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className='flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-5 sm:px-8 sm:pt-8'>
      <div>
        {section && (
          <p className='text-sm text-ink-muted'>
            {section} · <span className='font-bold text-accent-text'>{title}</span>
          </p>
        )}
        <h1 className='mt-1 font-display text-3xl font-bold'>{title}</h1>
        {description && <p className='mt-1 text-ink-muted'>{description}</p>}
      </div>
      {actions && <div className='flex flex-wrap gap-2'>{actions}</div>}
    </div>
  );
}
