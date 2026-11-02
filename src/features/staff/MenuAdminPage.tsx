import * as RadixSwitch from '@radix-ui/react-switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, DownloadCloud, Pencil, Plus, Search, Star, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CATEGORIES, CATEGORY_LABELS, DIETARY_LABELS, STATION_LABELS, type MenuItem } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys, useConfig, useMenu, useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Badge, Card, EmptyState, FoodImage, Skeleton } from '@/ui/Display';
import { Input } from '@/ui/Form';
import { MenuItemDialog } from './MenuItemDialog';
import { PageHeader } from './StaffLayout';

function AvailabilityToggle({ item }: { item: MenuItem }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (available: boolean) => api<MenuItem>(`/staff/menu/${item.id}`, { method: 'PATCH', body: { available } }),
    onMutate: async (available) => {
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
  return (
    <RadixSwitch.Root
      checked={item.available}
      onCheckedChange={(v) => toggle.mutate(v)}
      aria-label={`${item.name} available`}
      className='relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors duration-200 data-[state=checked]:bg-success'
    >
      <RadixSwitch.Thumb className='block size-6 translate-x-0.5 rounded-full bg-white shadow-raised transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[22px]' />
    </RadixSwitch.Root>
  );
}

export function MenuAdminPage() {
  const { data: menu, isLoading } = useMenu();
  const { data: config } = useConfig();
  const money = useMoney();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  // The item stays set while the dialog animates closed so its title doesn't flicker.
  const [dialog, setDialog] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null });
  const [confirmImport, setConfirmImport] = useState(false);

  const importSample = useMutation({
    mutationFn: () => api<MenuItem[]>('/staff/menu/import-sample', { method: 'POST' }),
    onSuccess: (items) => {
      qc.setQueryData(queryKeys.menu, items);
      setConfirmImport(false);
      toast.success(`Imported ${items.length} items`, { description: 'Remember to add allergen information before service.' });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const q = query.trim().toLowerCase();
  const items = (menu ?? []).filter((m) => !q || m.name.toLowerCase().includes(q));
  const soldOut = (menu ?? []).filter((m) => !m.available).length;
  const missingAllergens = (menu ?? []).filter((m) => m.allergens === null).length;

  return (
    <div>
      <PageHeader
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
              <Plus className='size-4' /> Add item
            </Button>
          </>
        }
      />

      <div className='space-y-6 px-4 pb-10 sm:px-8'>
        {missingAllergens > 0 && (
          <div className='flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0' />
            <p>
              {missingAllergens} {missingAllergens === 1 ? 'item has' : 'items have'} no allergen information. Guests will be
              asked to check with staff.
            </p>
          </div>
        )}

        <div className='relative max-w-sm'>
          <Search className='pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle' />
          <Input
            type='search'
            placeholder='Search items'
            aria-label='Search items'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='pl-10'
          />
        </div>

        {isLoading ? (
          <Skeleton className='h-96' />
        ) : items.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed className='size-6' />} title={q ? 'No matches' : 'Your menu is empty'}>
            {q ? 'Try a different search.' : 'Add your first dish to get started.'}
          </EmptyState>
        ) : (
          CATEGORIES.map((c) => {
            const rows = items.filter((m) => m.category === c);
            if (!rows.length) return null;
            return (
              <section key={c} aria-labelledby={`admin-${c}`}>
                <h2 id={`admin-${c}`} className='mb-2 font-display text-xl font-semibold'>
                  {CATEGORY_LABELS[c]} <span className='text-base font-normal text-ink-subtle'>{rows.length}</span>
                </h2>
                <Card className='divide-y divide-line overflow-hidden'>
                  {rows.map((m) => (
                    <div key={m.id} className={cn('flex items-center gap-4 px-4 py-3', !m.available && 'bg-surface-2/50')}>
                      <FoodImage
                        src={m.imageUrl}
                        alt={m.name}
                        className={cn('size-14 shrink-0 rounded-xl', !m.available && 'opacity-50 grayscale')}
                      />
                      <div className='min-w-0 flex-1'>
                        <p className='flex items-center gap-1.5 font-medium'>
                          <span className='truncate'>{m.name}</span>
                          {m.featured && <Star className='size-3.5 shrink-0 fill-accent text-accent' aria-label='Chef’s pick' />}
                        </p>
                        <p className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted'>
                          <span className='tabular'>{money(m.priceCents)}</span>
                          <span aria-hidden>·</span>
                          <span>{STATION_LABELS[m.station]}</span>
                          {m.dietary.slice(0, 3).map((d) => (
                            <Badge key={d} className='hidden sm:inline-flex'>
                              {DIETARY_LABELS[d]}
                            </Badge>
                          ))}
                          {m.allergens === null && <Badge tone='warning'>No allergen info</Badge>}
                        </p>
                      </div>
                      <div className='flex shrink-0 items-center gap-2 sm:gap-4'>
                        <span className={cn('hidden text-sm sm:inline', m.available ? 'text-success' : 'text-ink-subtle')}>
                          {m.available ? 'Available' : 'Sold out'}
                        </span>
                        <AvailabilityToggle item={m} />
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label={`Edit ${m.name}`}
                          onClick={() => setDialog({ open: true, item: m })}
                        >
                          <Pencil className='size-4' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })
        )}
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
