import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, DownloadCloud, Plus, Search, Star, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CATEGORIES, CATEGORY_LABELS, STATION_LABELS, type Category, type MenuItem } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useConfig, useMenu, useMoney } from '@/lib/queries';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState, FoodImage, Skeleton } from '@/ui/Display';
import { Chip, SearchField, SwitchControl } from '@/ui/Form';
import { MenuItemDialog, MenuItemPanel } from './MenuItemDialog';
import { PageHeader } from './StaffLayout';

function useToggleAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item, available }: { item: MenuItem; available: boolean }) =>
      api<MenuItem>(`/staff/menu/${item.id}`, { method: 'PATCH', body: { available } }),
    onMutate: async ({ item, available }) => {
      await qc.cancelQueries({ queryKey: queryKeys.menu });
      const prev = qc.getQueryData<MenuItem[]>(queryKeys.menu);
      qc.setQueryData<MenuItem[]>(queryKeys.menu, (list) => list?.map((m) => (m.id === item.id ? { ...m, available } : m)));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(queryKeys.menu, ctx?.prev);
      toast.error(errorMessage(err));
    },
    onSuccess: (m) => toast(m.available ? `${m.name} is back on` : `${m.name} marked sold out`, { duration: 1800 }),
  });
}

function ItemCard({ item, selected, onSelect }: { item: MenuItem; selected: boolean; onSelect: () => void }) {
  const money = useMoney();
  const toggle = useToggleAvailability();
  return (
    <li
      className={cn(
        'relative flex flex-col gap-2.5 rounded-[22px] p-2 transition-[border-color,background-color]',
        selected ? 'border-2 border-accent bg-accent-soft' : 'border-[1.5px] border-line bg-surface',
      )}
    >
      <button type='button' onClick={onSelect} className='absolute inset-0 z-0 rounded-[22px]' aria-label={`Edit ${item.name}`} />
      <div className='pointer-events-none relative'>
        <FoodImage
          src={item.imageUrl}
          alt={item.name}
          className={cn('aspect-[4/3] w-full rounded-2xl', !item.available && 'opacity-50 grayscale')}
        />
        {!item.available && (
          <span className='absolute top-2 left-2 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-canvas'>Sold out</span>
        )}
        {item.featured && (
          <span
            className='absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-highlight text-on-highlight'
            title='Chef’s pick'
          >
            <Star className='size-3.5 fill-current' />
            <span className='sr-only'>Chef’s pick</span>
          </span>
        )}
      </div>
      <div className='pointer-events-none px-1'>
        <p className='truncate text-sm font-bold'>{item.name}</p>
        <p className='mt-0.5 flex items-center justify-between gap-2'>
          <span className='tabular font-bold text-accent-text'>{money(item.priceCents)}</span>
          <span className='text-xs font-semibold text-ink-subtle'>{STATION_LABELS[item.station]}</span>
        </p>
      </div>
      <div className='relative z-[1] flex items-center justify-between gap-2 border-t border-line px-1 pt-2.5 pb-1'>
        <span className={cn('text-xs font-bold', item.available ? 'text-success' : 'text-ink-subtle')}>
          {item.available ? 'Available' : 'Sold out'}
        </span>
        <SwitchControl
          label={`${item.name} available`}
          checked={item.available}
          onCheckedChange={(available) => toggle.mutate({ item, available })}
        />
      </div>
    </li>
  );
}

export function MenuAdminPage() {
  const { data: menu, isLoading } = useMenu();
  const { data: config } = useConfig();
  const qc = useQueryClient();
  const wide = useMediaQuery('(min-width: 1280px)');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The item stays set while the dialog animates closed so its title doesn't flicker.
  const [dialog, setDialog] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null });
  const [confirmImport, setConfirmImport] = useState(false);

  const importSample = useMutation({
    mutationFn: () => api<MenuItem[]>('/staff/menu/import-sample', { method: 'POST' }),
    onSuccess: (items) => {
      qc.setQueryData(queryKeys.menu, items);
      setConfirmImport(false);
      setSelectedId(null);
      toast.success(`Imported ${items.length} items`, { description: 'Remember to add allergen information before service.' });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const q = query.trim().toLowerCase();
  const items = (menu ?? [])
    .filter((m) => category === 'all' || m.category === category)
    .filter((m) => !q || m.name.toLowerCase().includes(q));
  const soldOut = (menu ?? []).filter((m) => !m.available).length;
  const missingAllergens = (menu ?? []).filter((m) => m.allergens === null).length;
  const selected = menu?.find((m) => m.id === selectedId) ?? null;

  const open = (m: MenuItem) => {
    if (wide) setSelectedId(m.id);
    else setDialog({ open: true, item: m });
  };

  return (
    <div>
      <PageHeader
        section='Back office'
        title='Menu'
        description={menu ? `${menu.length} items${soldOut ? ` · ${soldOut} sold out` : ''}` : undefined}
        actions={
          <>
            {config?.demoMode && (
              <Button variant='secondary' onClick={() => setConfirmImport(true)}>
                <DownloadCloud className='size-4' /> Import sample menu
              </Button>
            )}
            <Button onClick={() => setDialog({ open: true, item: null })}>
              <Plus className='size-4' strokeWidth={2.6} /> Add item
            </Button>
          </>
        }
      />

      <div className='space-y-5 px-4 pb-10 sm:px-8'>
        {missingAllergens > 0 && (
          <div className='flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm font-medium text-warning'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
            <p>
              {missingAllergens} {missingAllergens === 1 ? 'item has' : 'items have'} no allergen information. Guests will be
              asked to check with staff.
            </p>
          </div>
        )}

        <div className='flex flex-wrap items-start gap-5'>
          <section
            aria-label='Menu items'
            className='flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-[28px] bg-surface p-4 shadow-card sm:p-5'
          >
            <div className='flex flex-wrap items-center gap-3'>
              <SearchField
                icon={<Search className='size-4.5' />}
                placeholder='Search items'
                aria-label='Search items'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='h-11 min-w-56 flex-1 bg-surface-2 shadow-none'
              />
              <div role='group' aria-label='Filter by category' className='flex flex-wrap gap-2'>
                <Chip tone='accent' selected={category === 'all'} onClick={() => setCategory('all')}>
                  All
                </Chip>
                {CATEGORIES.map((c) => (
                  <Chip key={c} tone='accent' selected={category === c} onClick={() => setCategory(c)}>
                    {CATEGORY_LABELS[c]}
                  </Chip>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4'>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className='h-60' />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<UtensilsCrossed className='size-6' />}
                title={q || category !== 'all' ? 'No matches' : 'Your menu is empty'}
              >
                {q || category !== 'all' ? 'Try a different search or category.' : 'Add your first dish to get started.'}
              </EmptyState>
            ) : (
              <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4'>
                {items.map((m) => (
                  <ItemCard key={m.id} item={m} selected={wide && selected?.id === m.id} onSelect={() => open(m)} />
                ))}
              </ul>
            )}
          </section>

          {wide && (
            <aside
              aria-label='Item editor'
              className='sticky top-8 max-h-[calc(100dvh-4rem)] flex-[1_1_360px] overflow-y-auto overscroll-contain rounded-[28px] bg-surface p-5 shadow-card'
            >
              {selected ? (
                <MenuItemPanel key={selected.id} item={selected} onClose={() => setSelectedId(null)} />
              ) : (
                <EmptyState className='py-16' icon={<UtensilsCrossed className='size-6' />} title='Select an item'>
                  Pick a dish to edit its price, photo, allergens and availability.
                </EmptyState>
              )}
            </aside>
          )}
        </div>
      </div>

      <MenuItemDialog open={dialog.open} item={dialog.item} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <ConfirmDialog
        open={confirmImport}
        onOpenChange={setConfirmImport}
        title='Replace the menu with a sample?'
        confirmLabel='Import'
        tone='danger'
        loading={importSample.isPending}
        onConfirm={() => importSample.mutate()}
      >
        Pulls dishes from TheMealDB and TheCocktailDB and <strong className='text-ink'>replaces every current menu item</strong>.
        Imported items have no allergen data. You can restore the original menu with “Reset demo data”.
      </ConfirmDialog>
    </div>
  );
}
