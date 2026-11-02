import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  DIETARY,
  DIETARY_LABELS,
  STATIONS,
  STATION_LABELS,
  type Allergen,
  type Dietary,
  type MenuItem,
} from '@shared/schemas';
import { type MenuItemInput, menuItemInputSchema } from '@shared/validation';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { FoodImage } from '@/ui/Display';
import { Chip, Field, Input, Select, Switch, Textarea } from '@/ui/Form';
import { Dialog } from '@/ui/Sheet';

interface FormState {
  name: string;
  description: string;
  price: string;
  category: MenuItem['category'];
  station: MenuItem['station'];
  imageUrl: string;
  dietary: Dietary[];
  allergensKnown: boolean;
  allergens: Allergen[];
  available: boolean;
  featured: boolean;
}

const blank: FormState = {
  name: '',
  description: '',
  price: '',
  category: 'mains',
  station: 'grill',
  imageUrl: '',
  dietary: [],
  allergensKnown: true,
  allergens: [],
  available: true,
  featured: false,
};

const fromItem = (m: MenuItem): FormState => ({
  name: m.name,
  description: m.description,
  price: (m.priceCents / 100).toFixed(2),
  category: m.category,
  station: m.station,
  imageUrl: m.imageUrl ?? '',
  dietary: m.dietary,
  allergensKnown: m.allergens !== null,
  allergens: m.allergens ?? [],
  available: m.available,
  featured: m.featured,
});

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Create (item = null) or edit a menu item. */
export function MenuItemDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: MenuItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (open) {
      setForm(item ? fromItem(item) : blank);
      setErrors({});
    }
  }, [open, item]);

  const save = useMutation({
    mutationFn: (body: MenuItemInput) =>
      item
        ? api<MenuItem>(`/staff/menu/${item.id}`, { method: 'PATCH', body })
        : api<MenuItem>('/staff/menu', { method: 'POST', body }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: queryKeys.menu });
      toast.success(item ? `Saved ${saved.name}` : `Added ${saved.name} to the menu`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api(`/staff/menu/${item!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu });
      toast.success(`Removed ${item!.name}`);
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNumber = Number(form.price.replace(/[^0-9.]/g, ''));
    const body: MenuItemInput = {
      name: form.name,
      description: form.description,
      priceCents: Number.isFinite(priceNumber) && form.price.trim() ? Math.round(priceNumber * 100) : -1,
      category: form.category,
      station: form.station,
      imageUrl: form.imageUrl.trim() || null,
      dietary: form.dietary,
      allergens: form.allergensKnown ? form.allergens : null,
      available: form.available,
      featured: form.featured,
    };
    const parsed = menuItemInputSchema.safeParse(body);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'priceCents' ? 'price' : (issue.path[0] as keyof FormState);
        next[key] ??= key === 'price' ? 'Enter a price, e.g. 12.50' : issue.message;
      }
      setErrors(next);
      return;
    }
    save.mutate(body);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={item ? 'Edit item' : 'New menu item'}
        className='max-w-2xl'
        footer={
          <>
            {item && (
              <Button variant='ghost' className='mr-auto text-danger hover:text-danger' onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button variant='ghost' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' form='menu-item-form' loading={save.isPending}>
              {item ? 'Save changes' : 'Add item'}
            </Button>
          </>
        }
      >
        <form id='menu-item-form' onSubmit={submit} className='space-y-5' noValidate>
          <div className='grid gap-4 sm:grid-cols-[1fr_140px]'>
            <Field label='Name' error={errors.name}>
              {(p) => <Input {...p} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />}
            </Field>
            <Field label='Price' error={errors.price}>
              {(p) => (
                <Input
                  {...p}
                  inputMode='decimal'
                  placeholder='0.00'
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  className='tabular'
                />
              )}
            </Field>
          </div>

          <Field label='Description' error={errors.description}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                maxLength={400}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            )}
          </Field>

          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='Category'>
              {(p) => (
                <Select {...p} value={form.category} onChange={(e) => set('category', e.target.value as FormState['category'])}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label='Kitchen station' hint='Where the ticket line is routed on the KDS'>
              {(p) => (
                <Select {...p} value={form.station} onChange={(e) => set('station', e.target.value as FormState['station'])}>
                  {STATIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATION_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className='grid gap-4 sm:grid-cols-[1fr_96px] sm:items-start'>
            <Field label='Photo URL' hint='A landscape photo works best' error={errors.imageUrl}>
              {(p) => (
                <Input
                  {...p}
                  type='url'
                  placeholder='https://…'
                  value={form.imageUrl}
                  onChange={(e) => set('imageUrl', e.target.value)}
                />
              )}
            </Field>
            <FoodImage
              src={form.imageUrl || null}
              alt={form.name || 'Preview'}
              className='hidden aspect-square w-24 rounded-xl sm:mt-7 sm:block'
            />
          </div>

          <fieldset>
            <legend className='mb-2 text-sm font-medium'>Dietary</legend>
            <div className='flex flex-wrap gap-2'>
              {DIETARY.map((d) => (
                <Chip key={d} selected={form.dietary.includes(d)} onClick={() => set('dietary', toggle(form.dietary, d))}>
                  {DIETARY_LABELS[d]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className='rounded-2xl border border-line p-4'>
            <legend className='px-1 text-sm font-medium'>Allergens</legend>
            <Switch
              checked={form.allergensKnown}
              onCheckedChange={(v) => set('allergensKnown', v)}
              label='Allergen information provided'
              description={
                form.allergensKnown ? 'Select everything this dish contains.' : 'Guests will be asked to check with staff.'
              }
            />
            {form.allergensKnown && (
              <div className='mt-4 flex flex-wrap gap-2'>
                {ALLERGENS.map((a) => (
                  <Chip key={a} selected={form.allergens.includes(a)} onClick={() => set('allergens', toggle(form.allergens, a))}>
                    {ALLERGEN_LABELS[a]}
                  </Chip>
                ))}
              </div>
            )}
          </fieldset>

          <div className='space-y-4'>
            <Switch
              checked={form.available}
              onCheckedChange={(v) => set('available', v)}
              label='Available'
              description='Turn off when an item sells out'
            />
            <Switch
              checked={form.featured}
              onCheckedChange={(v) => set('featured', v)}
              label='Chef’s pick'
              description='Highlight at the top of the menu'
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${item?.name ?? 'item'}?`}
        confirmLabel='Delete'
        tone='danger'
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        It will disappear from the menu immediately. Past orders keep their record of it.
      </ConfirmDialog>
    </>
  );
}
