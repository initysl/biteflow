import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  BellOff,
  ChefHat,
  ChevronsUpDown,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  QrCode,
  RotateCcw,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { StaffUser } from '@shared/schemas';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConfig, useMe, useStaffAssistance, useStaffOrders, useStaffTables } from '@/lib/queries';
import { realtime, useConnectionStatus, useRealtimeSubscription } from '@/lib/realtime';
import { playChime } from '@/lib/sound';
import { useTheme, type ThemePref } from '@/lib/theme';
import { Button } from '@/ui/Button';
import { Skeleton, StatusDot } from '@/ui/Display';
import { Dialog } from '@/ui/Sheet';

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
  icon: LucideIcon;
  group: 'Service' | 'Back office';
}

const NAV: NavItem[] = [
  { to: 'kitchen', label: 'Kitchen', icon: ChefHat, group: 'Service' },
  { to: 'floor', label: 'Floor', icon: LayoutGrid, group: 'Service' },
  { to: 'menu', label: 'Menu', icon: UtensilsCrossed, group: 'Back office' },
  { to: 'tables', label: 'Tables & QR', icon: QrCode, group: 'Back office' },
  { to: 'reports', label: 'Reports', icon: BarChart3, group: 'Back office' },
];

const menuButton =
  'h-10 rounded-xl text-[14px] font-semibold text-ink-muted hover:text-ink [&>svg]:size-[18px] ' +
  'data-[active=true]:bg-accent-soft data-[active=true]:font-bold data-[active=true]:text-accent-ink';

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AccountMenu({
  user,
  restaurant,
  soundOn,
  setSoundOn,
  onSignOut,
}: {
  user: StaffUser;
  restaurant?: string;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const [theme, setTheme] = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size='lg' className='rounded-xl data-[state=open]:bg-sidebar-accent'>
          <Avatar className='size-8 rounded-full'>
            <AvatarFallback className='rounded-full bg-ink text-xs font-bold text-canvas'>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className='grid flex-1 text-left leading-tight'>
            <span className='truncate text-sm font-bold text-ink'>{user.name}</span>
            <span className='truncate text-xs text-ink-muted'>{restaurant}</span>
          </span>
          <ChevronsUpDown className='ml-auto size-4' />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-60 rounded-2xl p-1.5' side={isMobile ? 'bottom' : 'right'} align='end' sideOffset={8}>
        <DropdownMenuLabel className='px-2 py-1.5'>
          <span className='block text-sm font-bold'>{user.name}</span>
          <span className='block text-xs font-normal text-ink-muted'>{restaurant}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem className='rounded-lg' checked={soundOn} onCheckedChange={(v) => setSoundOn(!!v)}>
          Sound alerts
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className='px-2 text-xs font-bold tracking-[0.06em] text-ink-subtle uppercase'>
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className='rounded-lg'>
              <Icon className='size-4 text-ink-muted' /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='rounded-lg font-semibold text-danger focus:text-danger' onSelect={onSignOut}>
          <LogOut className='size-4' /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar({
  user,
  counts,
  soundOn,
  setSoundOn,
  onReset,
  onSignOut,
}: {
  user: StaffUser;
  counts: Record<string, { count: number; tone: 'accent' | 'ink' } | undefined>;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  onReset: () => void;
  onSignOut: () => void;
}) {
  const { data: config } = useConfig();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible='icon' className='border-r border-line'>
      <SidebarHeader className='px-3 pt-4'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild className='rounded-xl hover:bg-transparent'>
              <Link to='/staff/kitchen' onClick={closeOnMobile}>
                <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent'>
                  <UtensilsCrossed className='size-4' />
                </span>
                <span className='grid flex-1 leading-tight'>
                  <span className='truncate font-display text-lg font-bold text-ink'>BiteFlow</span>
                  <span className='truncate text-xs text-ink-muted'>Staff console</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className='px-1'>
        {(['Service', 'Back office'] as const).map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className='text-[11px] font-bold tracking-[0.08em] text-ink-subtle uppercase'>
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className='gap-1'>
                {NAV.filter((n) => n.group === group).map(({ to, label, icon: Icon }) => {
                  const badge = counts[to];
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(`/staff/${to}`)}
                        tooltip={label}
                        className={menuButton}
                      >
                        <NavLink to={to} onClick={closeOnMobile}>
                          <Icon />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {badge && badge.count > 0 && (
                        <SidebarMenuBadge
                          className={cn(
                            'top-2.5 h-5 min-w-5 rounded-full px-1.5 text-[11px] font-bold',
                            // `!` beats the shadcn rule that recolours badge text on hovered/active rows.
                            badge.tone === 'accent' ? 'bg-accent !text-on-accent' : 'bg-ink !text-canvas',
                          )}
                        >
                          {badge.count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className='mt-auto'>
          <SidebarGroupContent>
            <SidebarMenu className='gap-1'>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip='Guest view' className={menuButton}>
                  <a href='/' target='_blank' rel='noreferrer'>
                    <ExternalLink />
                    <span>Guest view</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {config?.demoMode && (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip='Reset demo data' className={menuButton} onClick={onReset}>
                    <RotateCcw />
                    <span>Reset demo data</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className='border-t border-line px-3 py-3'>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu
              user={user}
              restaurant={config?.restaurantName}
              soundOn={soundOn}
              setSoundOn={setSoundOn}
              onSignOut={onSignOut}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function TopBar({ soundOn, setSoundOn }: { soundOn: boolean; setSoundOn: (v: boolean) => void }) {
  const { pathname } = useLocation();
  const status = useConnectionStatus();
  const current = NAV.find((n) => pathname.startsWith(`/staff/${n.to}`));
  const live = status === 'online';
  return (
    <header className='sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-6'>
      <SidebarTrigger className='-ml-1 size-9 rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink' />
      <Separator orientation='vertical' className='mr-1 data-[orientation=vertical]:h-5' />
      <Breadcrumb>
        <BreadcrumbList>
          {current && (
            <>
              <BreadcrumbItem className='hidden sm:inline-flex'>{current.group}</BreadcrumbItem>
              <BreadcrumbSeparator className='hidden sm:block' />
              <BreadcrumbItem>
                <BreadcrumbPage className='font-bold text-accent-text'>{current.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className='ml-auto flex items-center gap-1.5'>
        <span
          role='status'
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold',
            live ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
          )}
        >
          <StatusDot tone={live ? 'success' : 'warning'} pulse={!live} />
          {live ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </span>
        <button
          type='button'
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? 'Mute alerts' : 'Unmute alerts'}
          title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
          className='pressable inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'
        >
          {soundOn ? <Bell className='size-[18px]' /> : <BellOff className='size-[18px]' />}
        </button>
      </div>
    </header>
  );
}

function readSidebarCookie() {
  return !document.cookie.split('; ').includes('sidebar_state=false');
}

export function StaffLayout() {
  const me = useMe();
  const location = useLocation();
  const qc = useQueryClient();
  const [soundOn, setSoundOn] = useSoundPref();
  const [resetOpen, setResetOpen] = useState(false);
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

  const counts = {
    kitchen: { count: orders.data?.filter((o) => o.status === 'pending').length ?? 0, tone: 'accent' as const },
    floor: {
      count: (assistance.data?.length ?? 0) + (tables.data?.filter((t) => t.billRequest).length ?? 0),
      tone: 'ink' as const,
    },
  };

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={readSidebarCookie()} className='bg-canvas'>
        <ScrollRestoration />
        <p className='sr-only' aria-live='assertive'>
          {announcement}
        </p>
        <AppSidebar
          user={me.data}
          counts={counts}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          onReset={() => setResetOpen(true)}
          onSignOut={() => logout.mutate()}
        />
        <SidebarInset className='@container min-w-0 bg-canvas'>
          <TopBar soundOn={soundOn} setSoundOn={setSoundOn} />
          <Outlet />
        </SidebarInset>

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
      </SidebarProvider>
    </TooltipProvider>
  );
}

/** Shared page header for staff screens: title, description, optional actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className='flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-5 sm:px-6 lg:px-8'>
      <div className='min-w-0'>
        <h1 className='font-display text-3xl font-bold'>{title}</h1>
        {description && <p className='mt-1 text-ink-muted'>{description}</p>}
      </div>
      {actions && <div className='flex flex-wrap gap-2'>{actions}</div>}
    </div>
  );
}
