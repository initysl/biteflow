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

/**
 * Create (item = null) or edit a menu item. `formId` lets the caller render
 * the submit button wherever it likes (dialog footer or panel).
 */
function useMenuItemForm(item: MenuItem | null, active: boolean, onDone: () => void) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Reset only when a different item is opened — not when a background refetch
  // hands us a fresh copy of the same item mid-edit.
  const itemId = item?.id;
  useEffect(() => {
    if (active) {
      setForm(item ? fromItem(item) : blank);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId]);

  const save = useMutation({
    mutationFn: (body: MenuItemInput) =>
      item
        ? api<MenuItem>(`/staff/menu/${item.id}`, { method: 'PATCH', body })
        : api<MenuItem>('/staff/menu', { method: 'POST', body }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: queryKeys.menu });
      toast.success(item ? `Saved ${saved.name}` : `Added ${saved.name} to the menu`);
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api(`/staff/menu/${item!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu });
      toast.success(`Removed ${item!.name}`);
      onDone();
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

  return { form, set, errors, submit, save, remove };
}

function Fields({ formId, state, compact }: { formId: string; state: ReturnType<typeof useMenuItemForm>; compact?: boolean }) {
  const { form, set, errors, submit } = state;
  return (
    <form id={formId} onSubmit={submit} className='space-y-5' noValidate>
      <div className='grid grid-cols-[1fr_120px] gap-3'>
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
            rows={compact ? 2 : 3}
            maxLength={400}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>

      <div className='grid grid-cols-2 gap-3'>
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
        <Field label='Kitchen station'>
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

      <div className='grid grid-cols-[1fr_72px] items-start gap-3'>
        <Field label='Photo URL' error={errors.imageUrl}>
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
        <FoodImage src={form.imageUrl || null} alt={form.name || 'Preview'} className='mt-7 aspect-square w-18 rounded-2xl' />
      </div>

      <fieldset>
        <legend className='mb-2 text-sm font-bold'>Dietary</legend>
        <div className='flex flex-wrap gap-2'>
          {DIETARY.map((d) => (
            <Chip key={d} selected={form.dietary.includes(d)} onClick={() => set('dietary', toggle(form.dietary, d))}>
              {DIETARY_LABELS[d]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className='space-y-3'>
        <legend className='mb-2 text-sm font-bold'>Allergens</legend>
        <Switch
          checked={form.allergensKnown}
          onCheckedChange={(v) => set('allergensKnown', v)}
          label='Allergen information provided'
          description={
            form.allergensKnown ? 'Select everything this dish contains.' : 'Guests will be asked to check with staff.'
          }
        />
        {form.allergensKnown && (
          <div className='flex flex-wrap gap-2'>
            {ALLERGENS.map((a) => (
              <Chip key={a} selected={form.allergens.includes(a)} onClick={() => set('allergens', toggle(form.allergens, a))}>
                {ALLERGEN_LABELS[a]}
              </Chip>
            ))}
          </div>
        )}
      </fieldset>

      <div className='space-y-2'>
        <Switch
          checked={form.available}
          onCheckedChange={(v) => set('available', v)}
          label='Available'
          description='Turn off when it sells out'
        />
        <Switch
          checked={form.featured}
          onCheckedChange={(v) => set('featured', v)}
          label='Chef’s pick'
          description='Highlight at the top of the menu'
        />
      </div>
    </form>
  );
}

function DeleteConfirm({
  item,
  open,
  onOpenChange,
  state,
}: {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  state: ReturnType<typeof useMenuItemForm>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${item?.name ?? 'item'}?`}
      confirmLabel='Delete'
      tone='danger'
      loading={state.remove.isPending}
      onConfirm={() => state.remove.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
    >
      It will disappear from the menu immediately. Past orders keep their record of it.
    </ConfirmDialog>
  );
}

/** Modal editor for smaller screens and for creating items. */
export function MenuItemDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: MenuItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const state = useMenuItemForm(item, open, () => onOpenChange(false));
  const [confirmDelete, setConfirmDelete] = useState(false);
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
            <Button type='submit' form='menu-item-dialog-form' loading={state.save.isPending}>
              {item ? 'Save changes' : 'Add item'}
            </Button>
          </>
        }
      >
        <Fields formId='menu-item-dialog-form' state={state} />
      </Dialog>
      <DeleteConfirm item={item} open={confirmDelete} onOpenChange={setConfirmDelete} state={state} />
    </>
  );
}

/** Inline editor shown beside the grid on wide screens. */
export function MenuItemPanel({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const state = useMenuItemForm(item, true, onClose);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className='flex flex-col gap-5'>
      <div className='flex items-center gap-3'>
        <FoodImage src={item.imageUrl} alt={item.name} className='size-16 shrink-0 rounded-2xl' />
        <div className='min-w-0'>
          <p className='text-xs font-bold text-ink-muted'>Editing</p>
          <h2 className='truncate font-display text-xl font-bold'>{item.name}</h2>
        </div>
      </div>
      <Fields formId='menu-item-panel-form' state={state} compact />
      <div className='grid grid-cols-2 gap-2.5'>
        <Button variant='secondary' className='text-danger' onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
        <Button type='submit' form='menu-item-panel-form' variant='dark' loading={state.save.isPending}>
          Save changes
        </Button>
      </div>
      <DeleteConfirm item={item} open={confirmDelete} onOpenChange={setConfirmDelete} state={state} />
    </div>
  );
}
