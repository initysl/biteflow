import * as RadixSwitch from '@radix-ui/react-switch';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-subtle ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-danger disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'resize-none py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className='relative'>
      <select ref={ref} className={cn(control, 'h-11 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle' />
    </div>
  );
});

/** Label + control + hint/error, wired up with ids for assistive tech. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className='block text-sm font-medium text-ink'>
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className='text-sm text-danger'>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className='text-sm text-ink-subtle'>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className='flex items-center justify-between gap-4'>
      <label htmlFor={id} className='min-w-0'>
        <span className='block text-sm font-medium'>{label}</span>
        {description ? <span className='block text-sm text-ink-subtle'>{description}</span> : null}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className='relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors duration-200 data-[state=checked]:bg-accent disabled:opacity-50'
      >
        <RadixSwitch.Thumb className='block size-6 translate-x-0.5 rounded-full bg-white shadow-raised transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[22px]' />
      </RadixSwitch.Root>
    </div>
  );
}

/** Toggleable pill used for multi-select chips (dietary tags, filters). */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'pressable inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150',
        selected ? 'border-ink bg-ink text-canvas' : 'border-line-strong bg-surface text-ink-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}
