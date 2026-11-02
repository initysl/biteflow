import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Visually hide the title (it stays available to screen readers). */
  hideTitle?: boolean;
  className?: string;
}

function CloseButton({ className }: { className?: string }) {
  return (
    <RadixDialog.Close
      aria-label='Close'
      className={cn(
        'pressable inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      <X className='size-5' />
    </RadixDialog.Close>
  );
}

function Header({ title, description, hideTitle }: Pick<PanelProps, 'title' | 'description' | 'hideTitle'>) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', hideTitle && 'sr-only')}>
      <div className='min-w-0'>
        <RadixDialog.Title className='font-display text-2xl font-semibold tracking-tight'>{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className='mt-1 text-sm text-ink-muted'>{description}</RadixDialog.Description>
        ) : (
          <RadixDialog.Description className='sr-only'>{typeof title === 'string' ? title : ''}</RadixDialog.Description>
        )}
      </div>
      <CloseButton className='-mt-1 -mr-2' />
    </div>
  );
}

/** Bottom drawer on phones, right-hand panel from tablet up. */
export function Sheet({ open, onOpenChange, title, description, children, footer, hideTitle, className }: PanelProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className='overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]' />
        <RadixDialog.Content
          className={cn(
            'sheet-auto fixed z-50 flex flex-col bg-surface text-ink shadow-float outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-3xl',
            className,
          )}
        >
          <div className='mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong md:hidden' aria-hidden />
          <Header title={title} description={description} hideTitle={hideTitle} />
          {hideTitle && <CloseButton className='absolute top-3 right-3 z-10 bg-surface/80 backdrop-blur' />}
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>{children}</div>
          {footer ? (
            <div className='shrink-0 border-t border-line bg-surface px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Centered modal for focused tasks (forms, confirmations). */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: PanelProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className='overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]' />
        <RadixDialog.Content
          className={cn(
            'dialog fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-3xl bg-surface text-ink shadow-float outline-none',
            className,
          )}
        >
          <Header title={title} description={description} />
          <div className='min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5'>{children}</div>
          {footer ? <div className='flex shrink-0 justify-end gap-2 border-t border-line px-5 py-4'>{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
