import { Delete, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConfig, useIsManager } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Sheet';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

interface ApprovalRequest {
  action: string;
  resolve: (pin: string | null) => void;
}

const useApprovalStore = create<{ request: ApprovalRequest | null; set: (r: ApprovalRequest | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

/** Thrown when a staff member closes the approval prompt without a manager PIN. */
export class ApprovalCancelled extends Error {
  constructor() {
    super('Manager approval cancelled');
  }
}

export const isApprovalCancelled = (err: unknown) => err instanceof ApprovalCancelled;

function requestManagerPin(action: string): Promise<string | null> {
  return new Promise((resolve) => useApprovalStore.getState().set({ action, resolve }));
}

/**
 * Runs an action that needs a manager, the way a till does it: managers go
 * straight through; anyone else is asked for a manager's PIN, which is sent
 * with the request as `X-Manager-Pin`.
 */
export function useManagerAction() {
  const isManager = useIsManager();
  return useCallback(
    async <T,>(action: string, run: (headers?: Record<string, string>) => Promise<T>): Promise<T> => {
      if (isManager) return run();
      const pin = await requestManagerPin(action);
      if (!pin) throw new ApprovalCancelled();
      try {
        return await run({ 'X-Manager-Pin': pin });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'manager_approval') {
          toast.error(err.message, { description: 'Ask a manager to try again.' });
          throw new ApprovalCancelled();
        }
        throw err;
      }
    },
    [isManager],
  );
}

/** Mounted once in the staff layout. */
export function ManagerApprovalDialog() {
  const { request, set } = useApprovalStore();
  const { data: config } = useConfig();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (request) setPin('');
  }, [request]);

  const close = useCallback(
    (value: string | null) => {
      request?.resolve(value);
      set(null);
    },
    [request, set],
  );

  useEffect(() => {
    if (pin.length === PIN_LENGTH) close(pin);
  }, [pin, close]);

  const press = useCallback((key: (typeof KEYS)[number]) => {
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (key) setPin((p) => (p + key).slice(0, PIN_LENGTH));
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, press]);

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => !open && close(null)}
      title='Manager approval'
      description={request ? `${request.action} needs a manager. Ask a manager to enter their PIN.` : undefined}
      className='max-w-sm'
      footer={
        <Button variant='ghost' onClick={() => close(null)}>
          Cancel
        </Button>
      }
    >
      <div className='flex flex-col items-center'>
        <span className='flex size-12 items-center justify-center rounded-2xl bg-highlight text-on-highlight'>
          <ShieldCheck className='size-6' />
        </span>
        <div
          className='mt-5 flex justify-center gap-4'
          role='status'
          aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 transition-[background-color,border-color] duration-150',
                i < pin.length ? 'border-ink bg-ink' : 'border-line-strong',
              )}
            />
          ))}
        </div>
        <div className='mt-5 grid w-full max-w-60 grid-cols-3 gap-2'>
          {KEYS.map((key, i) =>
            key === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type='button'
                onClick={() => press(key)}
                aria-label={key === 'del' ? 'Delete digit' : key}
                className='pressable flex h-12 items-center justify-center rounded-xl bg-surface-2 font-display text-xl font-bold transition-colors hover:bg-surface-3'
              >
                {key === 'del' ? <Delete className='size-5 text-ink-muted' /> : key}
              </button>
            ),
          )}
        </div>
        {config?.demoMode && (
          <p className='mt-4 text-center text-xs text-ink-subtle'>
            This is a public demo: the manager PIN is private, so voids and deletions stay locked.
          </p>
        )}
      </div>
    </Dialog>
  );
}
