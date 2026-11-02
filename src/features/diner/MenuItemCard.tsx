import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DIETARY_LABELS, type MenuItem } from '@shared/schemas';
import { cn } from '@/lib/cn';
import { useMoney } from '@/lib/queries';
import { FoodImage } from '@/ui/Display';
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

export function MenuItemCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const money = useMoney();
  const { canAdd, inCart, quickAdd, bump } = useQuickAdd(item);

  return (
    <article
      className={cn(
        'group relative flex h-full gap-4 rounded-2xl border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow] duration-200',
        '[@media(hover:hover)]:hover:border-line-strong [@media(hover:hover)]:hover:shadow-raised',
        !item.available && 'opacity-60',
      )}
    >
      <button type='button' onClick={onOpen} className='absolute inset-0 z-0 rounded-2xl' aria-label={`View ${item.name}`} />
      <div className='pointer-events-none relative z-[1] flex min-w-0 flex-1 flex-col py-1 pl-1'>
        <h3 className='font-medium leading-snug'>{item.name}</h3>
        <p className='mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted'>{item.description}</p>
        <div className='mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3'>
          <span className='tabular font-medium'>{money(item.priceCents)}</span>
          {!item.available ? (
            <span className='text-xs font-medium text-danger'>Sold out</span>
          ) : (
            item.dietary.slice(0, 2).map((d) => (
              <span key={d} className='text-xs text-ink-subtle'>
                {DIETARY_LABELS[d]}
              </span>
            ))
          )}
        </div>
      </div>
      <div className='pointer-events-none relative z-[1] shrink-0'>
        <FoodImage src={item.imageUrl} alt={item.name} className='size-28 rounded-xl sm:size-32' />
        {canAdd && (
          <button
            type='button'
            onClick={quickAdd}
            aria-label={`Add ${item.name} to order`}
            className='pressable pointer-events-auto absolute -right-1.5 -bottom-1.5 inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border border-line bg-surface px-2.5 text-ink shadow-raised transition-colors hover:bg-surface-2'
          >
            {inCart > 0 ? (
              <span key={bump} className='tabular animate-pop text-sm font-semibold text-accent'>
                {inCart}
              </span>
            ) : null}
            <Plus className='size-4.5' />
          </button>
        )}
      </div>
    </article>
  );
}

export function FeaturedCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const money = useMoney();
  return (
    <button
      type='button'
      onClick={onOpen}
      className='pressable group w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-card sm:w-64'
    >
      <div className='relative aspect-[4/3] overflow-hidden'>
        <FoodImage
          src={item.imageUrl}
          alt={item.name}
          className='size-full transition-transform duration-500 ease-[var(--ease-out)] [@media(hover:hover)]:group-hover:scale-[1.03]'
        />
      </div>
      <div className='flex items-baseline justify-between gap-3 p-3.5'>
        <span className='truncate font-medium'>{item.name}</span>
        <span className='tabular shrink-0 text-sm text-ink-muted'>{money(item.priceCents)}</span>
      </div>
    </button>
  );
}
