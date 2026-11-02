import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DIETARY_LABELS, type MenuItem } from '@shared/schemas';
import { cn } from '@/lib/cn';
import { useMoney } from '@/lib/queries';
import { FoodImage, PricePill } from '@/ui/Display';
import { useCartLines, useCartStore } from '../cart/cartStore';
import { useDiner } from './DinerLayout';

function useQuickAdd(item: MenuItem) {
  const { tableId, canOrder } = useDiner();
  const add = useCartStore((s) => s.add);
  const lines = useCartLines(tableId);
  const inCart = lines.filter((l) => l.menuItemId === item.id).reduce((n, l) => n + l.quantity, 0);
  const [bump, setBump] = useState(0);
  const quickAdd = () => {
    add(tableId, item.id);
    setBump((b) => b + 1);
    toast.success(`Added ${item.name}`, { duration: 1500 });
  };
  return { canAdd: canOrder && item.available, inCart, quickAdd, bump };
}

function AddButton({ item, size = 'md' }: { item: MenuItem; size?: 'md' | 'sm' }) {
  const { canAdd, inCart, quickAdd, bump } = useQuickAdd(item);
  if (!canAdd) return null;
  return (
    <button
      type='button'
      onClick={quickAdd}
      aria-label={`Add ${item.name} to order`}
      className={cn(
        'pressable relative z-[1] inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-accent font-bold text-on-accent transition-colors hover:bg-accent-hover',
        size === 'sm' ? 'h-9 min-w-9 px-2' : 'h-10 min-w-10 px-2.5',
      )}
    >
      {inCart > 0 && (
        <span key={bump} className='tabular animate-pop pl-1 text-sm'>
          {inCart}
        </span>
      )}
      <Plus className='size-4.5' strokeWidth={2.6} />
    </button>
  );
}

/** Grid card used in the menu sections. */
export function MenuItemCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const money = useMoney();
  const tag = !item.available ? null : item.dietary[0];

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-3xl bg-surface p-2 shadow-card transition-shadow duration-200',
        '[@media(hover:hover)]:hover:shadow-raised',
      )}
    >
      <button type='button' onClick={onOpen} className='absolute inset-0 z-0 rounded-3xl' aria-label={`View ${item.name}`} />
      <div className='pointer-events-none relative'>
        <FoodImage
          src={item.imageUrl}
          alt={item.name}
          className={cn('aspect-[4/3] w-full rounded-[20px]', !item.available && 'opacity-50 grayscale')}
        />
        {!item.available ? (
          <span className='absolute top-2 left-2 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-canvas'>Sold out</span>
        ) : tag ? (
          <span className='absolute top-2 left-2 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-ink'>
            {DIETARY_LABELS[tag]}
          </span>
        ) : null}
      </div>
      <div className='pointer-events-none flex flex-1 flex-col px-1.5 pt-2.5 pb-1'>
        <h3 className='line-clamp-2 text-[15px] leading-snug font-bold'>{item.name}</h3>
        <p className='mt-0.5 line-clamp-1 hidden text-sm text-ink-muted sm:block'>{item.description}</p>
        <div className='mt-auto flex items-center justify-between gap-2 pt-3'>
          <PricePill>{money(item.priceCents)}</PricePill>
          <span className='pointer-events-auto'>
            <AddButton item={item} size='sm' />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Wide card for the chef's picks carousel. */
export function PickCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const money = useMoney();
  return (
    <article className='relative w-64 overflow-hidden rounded-3xl bg-surface shadow-card sm:w-72'>
      <button type='button' onClick={onOpen} className='absolute inset-0 z-0' aria-label={`View ${item.name}`} />
      <div className='pointer-events-none relative h-36 overflow-hidden'>
        <FoodImage src={item.imageUrl} alt={item.name} className='size-full' />
        <span className='absolute bottom-2.5 left-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-ink'>
          {item.dietary[0] ? DIETARY_LABELS[item.dietary[0]] : 'Chef’s pick'}
        </span>
      </div>
      <div className='pointer-events-none p-3.5'>
        <h3 className='truncate font-bold'>{item.name}</h3>
        <p className='truncate text-sm text-ink-muted'>{item.description}</p>
        <div className='mt-3 flex items-center justify-between'>
          <PricePill>{money(item.priceCents)}</PricePill>
          <span className='pointer-events-auto'>
            <AddButton item={item} />
          </span>
        </div>
      </div>
    </article>
  );
}
