import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { splitEvenly } from '@shared/money';
import type { BillRequest, SplitType } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { QuantityStepper } from '@/ui/Display';
import { Sheet } from '@/ui/Sheet';
import { useDiner } from './DinerLayout';

export function BillSheet({
  open,
  onOpenChange,
  outstandingCents,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outstandingCents: number;
  current: BillRequest | null;
}) {
  const { tableId, token, table } = useDiner();
  const money = useMoney();
  const qc = useQueryClient();
  const [split, setSplit] = useState<SplitType>(current?.split ?? 'single');
  const [people, setPeople] = useState(current?.people && current.people > 1 ? current.people : Math.min(table.seats, 4));

  useEffect(() => {
    if (open && current) {
      setSplit(current.split);
      if (current.people > 1) setPeople(current.people);
    }
  }, [open, current]);

  const request = useMutation({
    mutationFn: () =>
      api<BillRequest>('/bill-requests', {
        method: 'POST',
        body: { tableId, token, split, people: split === 'even' ? people : 1 },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
      toast.success('Bill requested', { description: 'Your server will bring a card machine over.' });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const shares = splitEvenly(outstandingCents, people);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title='Request the bill'
      description='Your server will bring the card machine to the table.'
      footer={
        <Button size='lg' className='w-full' loading={request.isPending} onClick={() => request.mutate()}>
          {current ? 'Update request' : 'Request the bill'}
        </Button>
      }
    >
      <div className='space-y-5 px-5 pt-4 pb-6'>
        <div className='rounded-2xl bg-surface-2 p-4'>
          <p className='text-sm text-ink-muted'>Outstanding</p>
          <p className='tabular font-display text-3xl font-semibold'>{money(outstandingCents)}</p>
        </div>

        <fieldset className='space-y-2'>
          <legend className='mb-2 text-sm font-medium'>How are you paying?</legend>
          {(
            [
              { value: 'single', title: 'One payment', hint: 'Someone’s got this' },
              { value: 'even', title: 'Split evenly', hint: 'Each person pays the same' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'pressable flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors',
                split === opt.value ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line hover:border-line-strong',
              )}
            >
              <input
                type='radio'
                name='split'
                value={opt.value}
                checked={split === opt.value}
                onChange={() => setSplit(opt.value)}
                className='size-4 accent-[var(--accent)]'
              />
              <span>
                <span className='block font-medium'>{opt.title}</span>
                <span className='block text-sm text-ink-muted'>{opt.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {split === 'even' && (
          <div className='flex items-center justify-between gap-4 rounded-2xl border border-line p-4'>
            <div>
              <p className='font-medium'>Number of people</p>
              <p className='tabular text-sm text-ink-muted'>
                {shares[0] === shares[shares.length - 1]
                  ? `${money(shares[0])} each`
                  : `${money(shares[shares.length - 1])}–${money(shares[0])} each`}
              </p>
            </div>
            <QuantityStepper value={people} onChange={setPeople} min={2} max={20} label='people' />
          </div>
        )}
      </div>
    </Sheet>
  );
}
