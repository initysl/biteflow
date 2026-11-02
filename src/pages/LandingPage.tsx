import { useMutation } from '@tanstack/react-query';
import { ArrowRight, ChefHat, MonitorSmartphone, QrCode, ReceiptText } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useConfig } from '@/lib/queries';
import { Button, buttonClasses } from '@/ui/Button';
import { FoodImage } from '@/ui/Display';
import { ThemeToggle } from '@/ui/ThemeToggle';

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=${w}`;

const FEATURES = [
  {
    icon: QrCode,
    title: 'Scan, browse, order',
    body: 'Every table gets its own QR code. Guests order and pay from their phone — no app, no sign-up.',
  },
  {
    icon: ChefHat,
    title: 'A kitchen display that keeps up',
    body: 'Orders land on the KDS instantly, routed by station, with timers that flag anything running late.',
  },
  {
    icon: ReceiptText,
    title: 'Settle up your way',
    body: 'Pay up-front by card, or run a tab and request the bill — split evenly when the table is ready.',
  },
];

export function LandingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: config } = useConfig();

  const openDemo = useMutation({
    mutationFn: () => api<{ tableId: string; token: string }>('/demo/table'),
    onSuccess: ({ tableId, token }) => navigate(`/t/${tableId}?k=${encodeURIComponent(token)}`),
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Old QR codes pointed at /?table=3.
  const legacyTable = params.get('table');
  if (legacyTable) return <Navigate to={`/t/${encodeURIComponent(legacyTable)}`} replace />;

  return (
    <div className='min-h-dvh bg-canvas'>
      <header className='mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6'>
        <span className='flex items-center gap-2.5'>
          <img src='/biteflow-mark.svg' alt='' className='size-10' />
          <span className='font-display text-2xl font-bold'>BiteFlow</span>
        </span>
        <div className='flex items-center gap-1'>
          <ThemeToggle />
          <Link to='/staff' className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            Staff sign in
          </Link>
        </div>
      </header>

      <main>
        <section className='mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16'>
          <div>
            <p className='inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted'>
              <MonitorSmartphone className='size-4 text-accent' />
              QR ordering for independent restaurants
            </p>
            <h1 className='mt-6 font-display text-5xl leading-[0.98] font-extrabold sm:text-6xl lg:text-7xl'>
              Table service,
              <br />
              <span className='text-accent-text'>without the wait.</span>
            </h1>
            <p className='mt-6 max-w-lg text-lg text-ink-muted'>
              Guests scan, order and pay from their table. Your kitchen sees it the same second. Your floor team spends time on
              hospitality, not order pads.
            </p>
            <div className='mt-8 flex flex-wrap gap-3'>
              {config?.demoMode !== false && (
                <Button size='lg' loading={openDemo.isPending} onClick={() => openDemo.mutate()}>
                  Try a demo table <ArrowRight className='size-4' />
                </Button>
              )}
              <Link to='/staff' className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
                Open the staff console
              </Link>
            </div>
            {config?.demoMode && (
              <p className='mt-4 text-sm text-ink-subtle'>
                Tip: open the demo table on your phone and the staff console on a laptop to watch orders arrive live.
              </p>
            )}
          </div>

          <div className='relative mx-auto grid w-full max-w-md grid-cols-2 gap-3 lg:max-w-none' aria-hidden>
            <FoodImage
              src={img('1568901346375-23c9450c58cd')}
              alt='Burger'
              className='aspect-[3/4] w-full rounded-3xl shadow-raised'
            />
            <div className='grid gap-3 pt-10'>
              <FoodImage
                src={img('1476124369491-e7addf5db371', 600)}
                alt='Risotto'
                className='aspect-square w-full rounded-3xl shadow-raised'
              />
              <FoodImage
                src={img('1571877227200-a0d98ea607e9', 600)}
                alt='Tiramisu'
                className='aspect-square w-full rounded-3xl shadow-raised'
              />
            </div>
            <div className='absolute -bottom-6 left-4 rounded-2xl border border-line bg-surface/95 p-4 shadow-float backdrop-blur sm:left-8'>
              <p className='text-xs font-medium tracking-wide text-ink-subtle uppercase'>Table 4 · Order #1042</p>
              <p className='mt-1 flex items-center gap-2 font-medium'>
                <span className='size-2 rounded-full bg-success' /> Ready — on its way
              </p>
            </div>
          </div>
        </section>

        <section className='border-t border-line bg-surface'>
          <div className='mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3'>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className='flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink'>
                  <Icon className='size-5' />
                </span>
                <h2 className='mt-4 font-display text-xl font-bold'>{title}</h2>
                <p className='mt-2 text-ink-muted'>{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className='border-t border-line'>
        <div className='mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-ink-subtle sm:px-6'>
          <span>© {new Date().getFullYear()} BiteFlow</span>
          <span>Built with React, Express & SQLite</span>
        </div>
      </footer>
    </div>
  );
}
