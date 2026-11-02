import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'highlight';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  highlight: 'bg-highlight text-on-highlight',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The black price tag used across menu cards. */
export function PricePill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center rounded-full bg-ink px-3 py-1.5 text-sm leading-none font-bold text-canvas',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-2xl bg-surface-3/70', className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className='mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink'>{icon}</div>
      ) : null}
      <h3 className='font-display text-xl font-bold'>{title}</h3>
      {children ? <p className='mt-1.5 max-w-sm text-[15px] text-ink-muted'>{children}</p> : null}
      {action ? <div className='mt-5'>{action}</div> : null}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 50,
  size = 'md',
  label,
  tone = 'default',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label: string;
  /** `onAccent` sits inside an orange bar. */
  tone?: 'default' | 'onAccent';
}) {
  const onAccent = tone === 'onAccent';
  const btn = cn(
    'pressable inline-flex items-center justify-center rounded-full transition-colors disabled:opacity-40',
    size === 'sm' ? 'size-8' : 'size-10',
    onAccent ? 'bg-on-accent/15 text-on-accent hover:bg-on-accent/25' : 'text-ink hover:bg-surface-3',
  );
  const plus = cn(btn, onAccent && 'bg-on-accent text-accent hover:bg-on-accent/90');
  const icon = size === 'sm' ? 'size-3.5' : 'size-4';
  return (
    <div
      role='group'
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full p-1',
        onAccent ? 'bg-black/15' : 'border border-line-strong bg-surface',
      )}
    >
      <button
        type='button'
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={value === 1 && min === 0 ? `Remove ${label}` : `Decrease ${label}`}
      >
        {value === 1 && min === 0 ? <Trash2 className={icon} /> : <Minus className={icon} strokeWidth={2.6} />}
      </button>
      <span
        className={cn('tabular text-center font-bold', size === 'sm' ? 'w-6 text-sm' : 'w-7', onAccent && 'text-on-accent')}
        aria-live='polite'
      >
        {value}
      </span>
      <button
        type='button'
        className={plus}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className={icon} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** Food photo with graceful fallback when the image is missing or fails to load. */
export function FoodImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        aria-hidden
        className={cn(
          'flex items-center justify-center bg-accent-soft font-display text-3xl font-bold text-accent-ink',
          className,
        )}
      >
        {alt.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      decoding='async'
      referrerPolicy='no-referrer'
      onError={() => setFailed(true)}
      className={cn('bg-surface-2 object-cover', className)}
    />
  );
}

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  const color = {
    neutral: 'bg-ink-subtle',
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    highlight: 'bg-highlight',
  }[tone];
  return (
    <span className='relative inline-flex size-2'>
      {pulse ? (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60 [animation-duration:1.6s]', color)} />
      ) : null}
      <span className={cn('relative inline-flex size-2 rounded-full', color)} />
    </span>
  );
}
