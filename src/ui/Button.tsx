import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-glow hover:bg-accent-hover disabled:shadow-none',
  dark: 'bg-ink text-canvas hover:bg-ink/85',
  secondary: 'bg-surface text-ink border border-line-strong shadow-card hover:bg-surface-2',
  soft: 'bg-accent-soft text-accent-ink hover:bg-accent-soft/70',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:bg-danger/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-14 px-7 text-base gap-2',
  icon: 'size-11',
  'icon-sm': 'size-9',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'pressable inline-flex shrink-0 items-center justify-center rounded-full font-bold whitespace-nowrap select-none',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-55',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? <Spinner className='size-4' /> : null}
      {children}
    </button>
  );
});
