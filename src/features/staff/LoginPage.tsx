import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { StaffUser } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useConfig } from '@/lib/queries';
import { Spinner } from '@/ui/Spinner';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function LoginPage() {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { data: config } = useConfig();
  const from = (location.state as { from?: string } | null)?.from ?? '/staff/register';

  const login = useMutation({
    mutationFn: (value: string) => api<StaffUser>('/auth/login', { method: 'POST', body: { pin: value } }),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.me, user);
      navigate(from, { replace: true });
    },
    onError: () => {
      setShake((s) => s + 1);
      setPin('');
    },
  });

  const press = (key: (typeof KEYS)[number]) => {
    if (login.isPending) return;
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (!key) return;
    setPin((p) => (p + key).slice(0, PIN_LENGTH));
  };

  // Submit once the last digit lands. This lives in an effect, not the state
  // updater above, because React may run updaters twice (StrictMode) and each
  // run would send a login attempt — burning through the rate limit.
  const { mutate, isPending } = login;
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !isPending) mutate(pin);
  }, [pin, isPending, mutate]);

  // Physical keyboards and number pads work too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className='grid min-h-dvh place-items-center bg-canvas px-4 py-10'>
      <div className='w-full max-w-xs'>
        <Link to='/' className='inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink'>
          <ArrowLeft className='size-4' /> Back
        </Link>
        <div className='mt-6 text-center'>
          <img src='/biteflow-mark.svg' alt='' className='mx-auto size-14' />
          <h1 className='mt-4 font-display text-3xl font-bold'>Staff sign in</h1>
          <p className='mt-1 text-ink-muted'>Enter your {PIN_LENGTH}-digit PIN</p>
        </div>

        <div
          key={shake}
          className={cn('mt-8 flex justify-center gap-4', shake > 0 && 'animate-[shake_380ms_var(--ease-out)]')}
          role='status'
          aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 transition-[background-color,border-color,transform] duration-150',
                i < pin.length ? 'scale-110 border-ink bg-ink' : 'border-line-strong',
              )}
            />
          ))}
        </div>
        <p className='mt-4 h-5 text-center text-sm text-danger' aria-live='assertive'>
          {login.isError ? errorMessage(login.error) : ''}
        </p>

        <div className='mt-4 grid grid-cols-3 gap-3'>
          {KEYS.map((key, i) =>
            key === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type='button'
                onClick={() => press(key)}
                aria-label={key === 'del' ? 'Delete digit' : key}
                className='pressable flex h-16 items-center justify-center rounded-2xl bg-surface font-display text-2xl font-medium shadow-card transition-colors hover:bg-surface-2'
              >
                {key === 'del' ? <Delete className='size-6 text-ink-muted' /> : key}
              </button>
            ),
          )}
        </div>

        <div className='mt-6 flex h-6 justify-center'>{login.isPending && <Spinner className='text-ink-muted' />}</div>
        {config?.demoPin && (
          <p className='mt-2 text-center text-sm text-ink-subtle'>
            Demo PIN: <span className='tabular font-medium text-ink-muted'>{config.demoPin}</span>
          </p>
        )}
      </div>
    </div>
  );
}
