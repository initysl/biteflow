import * as RadixSwitch from '@radix-ui/react-switch';
import { ChevronDown } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-ink-subtle ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'focus:border-accent focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-danger disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, 'h-12', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'resize-none py-3 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className='relative'>
      <select ref={ref} className={cn(control, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className='pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-subtle' />
    </div>
  );
});

/** Rounded search field with a leading icon slot. */
export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }>(
  function SearchField({ className, icon, ...props }, ref) {
    return (
      <label
        className={cn(
          'flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 shadow-card focus-within:ring-4 focus-within:ring-accent/15',
          className,
        )}
      >
        <span className='text-ink-subtle'>{icon}</span>
        <input
          ref={ref}
          type='search'
          className='h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle'
          {...props}
        />
      </label>
    );
  },
);

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
      <label htmlFor={id} className='block text-sm font-bold text-ink'>
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

export function SwitchControl({
  checked,
  onCheckedChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className='relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors duration-200 data-[state=checked]:bg-success disabled:opacity-50'
    >
      <RadixSwitch.Thumb className='block size-6 translate-x-0.5 rounded-full bg-white shadow-raised transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[22px]' />
    </RadixSwitch.Root>
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
    <div className='flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3'>
      <label htmlFor={id} className='min-w-0'>
        <span className='block text-sm font-bold'>{label}</span>
        {description ? <span className='block text-sm text-ink-muted'>{description}</span> : null}
      </label>
      <SwitchControl id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/** Toggleable pill used for filters and multi-select chips. */
export function Chip({
  selected,
  onClick,
  children,
  className,
  tone = 'ink',
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** `accent` fills orange when selected (primary filters); `ink` fills black. */
  tone?: 'ink' | 'accent';
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'pressable inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors duration-150',
        selected
          ? tone === 'accent'
            ? 'bg-accent text-on-accent'
            : 'bg-ink text-canvas'
          : 'border border-line-strong bg-surface text-ink-muted hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}
