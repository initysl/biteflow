import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ALLERGEN_LABELS, CATEGORY_LABELS, DIETARY_LABELS, type MenuItem } from '@shared/schemas';
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
      <div className='flex gap-3 rounded-3xl bg-warning-soft p-4 text-sm font-medium text-warning'>
        <AlertTriangle className='mt-0.5 size-4 shrink-0' />
        <p>Allergen information isn’t available for this dish. Please ask a member of staff before ordering.</p>
      </div>
    );
  }
  return (
    <div className='rounded-3xl bg-surface-2 p-4'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-bold'>Allergens</h3>
        <span className='text-xs font-semibold text-ink-muted'>Tell staff about allergies</span>
      </div>
      {allergens.length === 0 ? (
        <p className='mt-2 text-sm text-ink-muted'>No major allergens declared.</p>
      ) : (
        <ul className='mt-3 flex flex-wrap gap-1.5' aria-label='Contains'>
          {allergens.map((a) => (
            <li key={a} className='rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-ink'>
              {ALLERGEN_LABELS[a]}
            </li>
          ))}
        </ul>
      )}
      <p className='mt-3 text-xs text-ink-subtle'>Prepared in a kitchen that handles all major allergens.</p>
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
            <div className='flex h-16 items-center gap-2 rounded-full bg-accent p-1.5 pl-2 shadow-glow'>
              <button
                type='button'
                onClick={submit}
                className='pressable h-full flex-1 rounded-full px-4 text-left text-base font-bold text-on-accent'
              >
                Add to order · <span className='tabular'>{money(shown.priceCents * quantity)}</span>
              </button>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} label={shown.name} tone='onAccent' />
            </div>
          ) : (
            <Button size='lg' variant='dark' className='w-full' disabled>
              Sold out today
            </Button>
          )
        ) : (
          <p className='text-center text-sm text-ink-muted'>Scan the QR code on your table to order.</p>
        )
      }
    >
      <div className='px-4 pt-4'>
        <div className='relative overflow-hidden rounded-[24px]'>
          <FoodImage src={shown.imageUrl} alt={shown.name} className='aspect-[4/3] w-full md:aspect-[16/12]' />
          <span className='tabular absolute bottom-3 left-3 rounded-full bg-accent px-4 py-2 font-display text-xl font-bold text-on-accent'>
            {money(shown.priceCents)}
          </span>
          {shown.featured && (
            <span className='absolute top-3 left-3 rounded-full bg-highlight px-3 py-1.5 text-xs font-bold text-on-highlight'>
              Chef’s pick
            </span>
          )}
        </div>
      </div>
      <div className='space-y-5 px-5 pt-5 pb-6'>
        <div>
          <p className='text-sm font-bold text-accent-text'>{CATEGORY_LABELS[shown.category]}</p>
          <h2 className='mt-1 font-display text-3xl leading-tight font-bold'>{shown.name}</h2>
          {shown.dietary.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-1.5'>
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
          <div className='space-y-2'>
            <label htmlFor='item-note' className='font-bold'>
              Special requests <span className='font-medium text-ink-subtle'>(optional)</span>
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
