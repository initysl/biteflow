import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Droplets, HandPlatter, MessageCircleQuestion, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { ASSISTANCE_LABELS, type AssistanceRequest, type AssistanceType } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queries';
import { relativeTime } from '@/lib/time';
import { Sheet } from '@/ui/Sheet';

const OPTIONS: { type: AssistanceType; icon: typeof Droplets; hint: string }[] = [
  { type: 'server', icon: HandPlatter, hint: 'Questions, changes, or anything else' },
  { type: 'water', icon: Droplets, hint: 'Still or tap water for the table' },
  { type: 'cutlery', icon: UtensilsCrossed, hint: 'Extra cutlery, plates or napkins' },
  { type: 'other', icon: MessageCircleQuestion, hint: 'We’ll come over to help' },
];

export function AssistanceSheet({
  open,
  onOpenChange,
  tableId,
  token,
  active,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableId: string;
  token: string;
  active: AssistanceRequest[];
}) {
  const qc = useQueryClient();
  const request = useMutation({
    mutationFn: (type: AssistanceType) =>
      api<AssistanceRequest>('/assistance', { method: 'POST', body: { tableId, token, type } }),
    onSuccess: (req) => {
      qc.invalidateQueries({ queryKey: queryKeys.tableAssistance(tableId) });
      toast.success('The team has been notified', {
        description: `${ASSISTANCE_LABELS[req.type]} — someone will be right over.`,
      });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title='How can we help?' description='Your server gets an instant alert.'>
      <div className='space-y-2.5 px-5 pt-4 pb-6'>
        {OPTIONS.map(({ type, icon: Icon, hint }) => {
          const pending = active.find((a) => a.type === type);
          return (
            <button
              key={type}
              type='button'
              disabled={!!pending || request.isPending}
              onClick={() => request.mutate(type)}
              className={cn(
                'pressable flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors',
                pending
                  ? 'border-success/30 bg-success-soft'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl',
                  pending ? 'bg-success text-canvas' : 'bg-accent-soft text-accent-ink',
                )}
              >
                {pending ? <Check className='size-5' /> : <Icon className='size-5' />}
              </span>
              <span className='min-w-0'>
                <span className='block font-medium'>{ASSISTANCE_LABELS[type]}</span>
                <span className='block text-sm text-ink-muted'>
                  {pending ? `Requested ${relativeTime(pending.createdAt)} · on the way` : hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
