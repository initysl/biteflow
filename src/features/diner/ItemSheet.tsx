import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ALLERGEN_LABELS, DIETARY_LABELS, type MenuItem } from '@shared/schemas';
import { useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { Badge, FoodImage, QuantityStepper } from '@/ui/Display';
import { Textarea } from '@/ui/Form';
import { Sheet } from '@/ui/Sheet';
import { useCartStore } from '../cart/cartStore';
import { useDiner } from './DinerLayout';

function Allergens({ allergens }: { allergens: MenuItem['allergens'] }) {
  if (allergens === null) {
    return (
      <div className='flex gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning'>
        <AlertTriangle className='mt-0.5 size-4 shrink-0' />
        <p>Allergen information isn’t available for this dish. Please ask a member of staff before ordering.</p>
      </div>
    );
  }
  return (
    <div className='rounded-2xl border border-line p-4'>
      <h3 className='text-sm font-medium'>Allergens</h3>
      {allergens.length === 0 ? (
        <p className='mt-1 text-sm text-ink-muted'>No major allergens declared.</p>
      ) : (
        <p className='mt-1 text-sm text-ink-muted'>
          Contains{' '}
          {allergens.map((a, i) => (
            <span key={a}>
              <strong className='font-medium text-ink'>{ALLERGEN_LABELS[a]}</strong>
              {i < allergens.length - 2 ? ', ' : i === allergens.length - 2 ? ' and ' : '.'}
            </span>
          ))}
        </p>
      )}
      <p className='mt-2 flex items-start gap-1.5 text-xs text-ink-subtle'>
        <Info className='mt-px size-3.5 shrink-0' />
        Dishes are prepared in a kitchen that handles all major allergens.
      </p>
    </div>
  );
}

export function ItemSheet({ item, onOpenChange }: { item: MenuItem | null; onOpenChange: (open: boolean) => void }) {
  const { tableId, canOrder } = useDiner();
  const money = useMoney();
  const add = useCartStore((s) => s.add);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  // Keep showing the last item while the sheet animates closed.
  const [shown, setShown] = useState<MenuItem | null>(item);

  useEffect(() => {
    if (item) {
      setShown(item);
      setQuantity(1);
      setNote('');
    }
  }, [item]);

  if (!shown) return null;

  const submit = () => {
    add(tableId, shown.id, quantity, note);
    toast.success(`Added ${quantity > 1 ? `${quantity} × ` : ''}${shown.name}`, { duration: 1800 });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={!!item}
      onOpenChange={onOpenChange}
      title={shown.name}
      hideTitle
      footer={
        canOrder ? (
          shown.available ? (
            <div className='flex items-center gap-3'>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} label={shown.name} />
              <Button size='lg' className='flex-1' onClick={submit}>
                Add to order · <span className='tabular'>{money(shown.priceCents * quantity)}</span>
              </Button>
            </div>
          ) : (
            <Button size='lg' className='w-full' disabled>
              Sold out today
            </Button>
          )
        ) : (
          <p className='text-center text-sm text-ink-muted'>Scan the QR code on your table to order.</p>
        )
      }
    >
      <FoodImage src={shown.imageUrl} alt={shown.name} className='aspect-[4/3] w-full md:aspect-[16/11]' />
      <div className='space-y-5 px-5 pt-5 pb-6'>
        <div>
          <div className='flex items-start justify-between gap-4'>
            <h2 className='font-display text-3xl leading-tight font-semibold tracking-tight'>{shown.name}</h2>
            <span className='tabular pt-1.5 text-lg font-medium'>{money(shown.priceCents)}</span>
          </div>
          {shown.dietary.length > 0 && (
            <div className='mt-2.5 flex flex-wrap gap-1.5'>
              {shown.dietary.map((d) => (
                <Badge key={d} tone={d === 'spicy' ? 'danger' : 'success'}>
                  {DIETARY_LABELS[d]}
                </Badge>
              ))}
            </div>
          )}
          <p className='mt-3 text-[15px] leading-relaxed text-ink-muted'>{shown.description}</p>
        </div>

        <Allergens allergens={shown.allergens} />

        {canOrder && shown.available && (
          <div className='space-y-1.5'>
            <label htmlFor='item-note' className='text-sm font-medium'>
              Special requests <span className='font-normal text-ink-subtle'>(optional)</span>
            </label>
            <Textarea
              id='item-note'
              rows={2}
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. no onions, sauce on the side'
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
