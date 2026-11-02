import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-3/70', className)} />;
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
        <div className='mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-subtle'>{icon}</div>
      ) : null}
      <h3 className='font-display text-xl font-semibold'>{title}</h3>
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
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label: string;
}) {
  const btn = cn(
    'pressable inline-flex items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-3 disabled:opacity-40',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  const icon = size === 'sm' ? 'size-3.5' : 'size-4';
  return (
    <div
      role='group'
      aria-label={label}
      className='inline-flex items-center rounded-full border border-line-strong bg-surface p-0.5'
    >
      <button
        type='button'
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={value === 1 && min === 0 ? `Remove ${label}` : `Decrease ${label}`}
      >
        {value === 1 && min === 0 ? <Trash2 className={icon} /> : <Minus className={icon} />}
      </button>
      <span className={cn('tabular text-center font-semibold', size === 'sm' ? 'w-6 text-sm' : 'w-8')} aria-live='polite'>
        {value}
      </span>
      <button
        type='button'
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className={icon} />
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
        className={cn('flex items-center justify-center bg-surface-2 font-display text-3xl text-ink-subtle', className)}
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
