import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard, HandCoins, ShoppingBag, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Order, PaymentMethod, Quote } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConfig, useMenu, useMoney } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { EmptyState, FoodImage, QuantityStepper } from '@/ui/Display';
import { Input, Textarea } from '@/ui/Form';
import { Sheet } from '@/ui/Sheet';
import { useCartLines, useCartStore } from '../cart/cartStore';
import { useDiner } from './DinerLayout';

interface PlacedResponse {
  order: Order;
  checkout: { redirectUrl?: string } | null;
}

export function CartSheet({
  open,
  onOpenChange,
  onPlaced,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPlaced: (order: Order, needsPayment: boolean) => void;
}) {
  const { tableId, token, trackOrder } = useDiner();
  const money = useMoney();
  const { data: config } = useConfig();
  const { data: menu } = useMenu();
  const lines = useCartLines(tableId);
  const { setQuantity, clear } = useCartStore();
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>('card');

  const items = lines.map(({ menuItemId, quantity, note }) => ({ menuItemId, quantity, note }));
  const quote = useQuery({
    queryKey: ['quote', items, promoCode],
    queryFn: () => api<Quote>('/quote', { method: 'POST', body: { items, promoCode } }),
    enabled: open && items.length > 0,
    placeholderData: keepPreviousData,
  });

  const place = useMutation({
    mutationFn: () =>
      api<PlacedResponse>('/orders', {
        method: 'POST',
        body: { tableId, token, items, notes: notes || undefined, promoCode, paymentMethod: method },
      }),
    onSuccess: ({ order, checkout }) => {
      trackOrder(order.id);
      clear(tableId);
      setNotes('');
      setPromoCode(undefined);
      setPromoInput('');
      if (checkout?.redirectUrl) {
        window.location.assign(checkout.redirectUrl);
        return;
      }
      if (order.status === 'awaiting_payment') {
        onPlaced(order, true);
      } else {
        toast.success(`Order #${order.number} sent to the kitchen`);
        onPlaced(order, false);
      }
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      quote.refetch();
    },
  });

  const q = quote.data;
  const promoError = promoCode ? q?.promoError : null;
  const total = q?.totalCents ?? 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title='Your order'
      description={lines.length ? 'Review and send it to the kitchen.' : undefined}
      footer={
        lines.length > 0 ? (
          <div className='space-y-4'>
            <dl className='space-y-1.5 text-[15px]'>
              <div className='flex justify-between text-ink-muted'>
                <dt>Subtotal</dt>
                <dd className='tabular'>{q ? money(q.subtotalCents) : '—'}</dd>
              </div>
              {q && q.discountCents > 0 && (
                <div className='flex justify-between text-success'>
                  <dt>{q.promo?.label ?? 'Discount'}</dt>
                  <dd className='tabular'>−{money(q.discountCents)}</dd>
                </div>
              )}
              <div className='flex justify-between pt-1 text-lg font-semibold'>
                <dt>Total</dt>
                <dd className='tabular'>{q ? money(total) : '—'}</dd>
              </div>
            </dl>
            <Button
              size='lg'
              className='w-full'
              loading={place.isPending}
              disabled={!q || quote.isError}
              onClick={() => place.mutate()}
            >
              {method === 'card' ? `Pay ${q ? money(total) : ''}` : 'Send order to kitchen'}
            </Button>
          </div>
        ) : null
      }
    >
      {lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag className='size-6' />} title='Nothing here yet'>
          Add a few dishes from the menu and they’ll show up here.
        </EmptyState>
      ) : (
        <div className='space-y-6 px-5 pt-4 pb-6'>
          <ul className='divide-y divide-line'>
            {lines.map((line) => {
              const item = menu?.find((m) => m.id === line.menuItemId);
              if (!item) return null;
              return (
                <li key={line.key} className='flex gap-3 py-3 first:pt-0'>
                  <FoodImage src={item.imageUrl} alt={item.name} className='size-16 shrink-0 rounded-xl' />
                  <div className='min-w-0 flex-1'>
                    <div className='flex justify-between gap-3'>
                      <p className='font-medium leading-snug'>{item.name}</p>
                      <p className='tabular shrink-0'>{money(item.priceCents * line.quantity)}</p>
                    </div>
                    {line.note && <p className='mt-0.5 text-sm text-ink-muted italic'>“{line.note}”</p>}
                    {!item.available && <p className='mt-0.5 text-sm text-danger'>Sold out — please remove</p>}
                    <div className='mt-2'>
                      <QuantityStepper
                        size='sm'
                        value={line.quantity}
                        onChange={(v) => setQuantity(tableId, line.key, v)}
                        label={item.name}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className='space-y-1.5'>
            <label htmlFor='order-notes' className='text-sm font-medium'>
              Note for the kitchen <span className='font-normal text-ink-subtle'>(optional)</span>
            </label>
            <Textarea
              id='order-notes'
              rows={2}
              maxLength={280}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Allergies, timing, celebrations…'
            />
          </div>

          <div>
            {promoCode && !promoError ? (
              <div className='flex items-center justify-between rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-success'>
                <span className='flex items-center gap-2'>
                  <Tag className='size-4' /> <strong className='font-semibold'>{promoCode}</strong> applied
                </span>
                <button
                  type='button'
                  aria-label='Remove promo code'
                  className='pressable rounded-full p-1 hover:bg-success/10'
                  onClick={() => {
                    setPromoCode(undefined);
                    setPromoInput('');
                  }}
                >
                  <X className='size-4' />
                </button>
              </div>
            ) : (
              <form
                className='flex gap-2'
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promoInput.trim()) setPromoCode(promoInput.trim().toUpperCase());
                }}
              >
                <Input
                  aria-label='Promo code'
                  placeholder='Promo code'
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    if (promoCode) setPromoCode(undefined);
                  }}
                  aria-invalid={!!promoError}
                  className='uppercase placeholder:normal-case'
                />
                <Button type='submit' variant='secondary' disabled={!promoInput.trim()}>
                  Apply
                </Button>
              </form>
            )}
            {promoError && <p className='mt-1.5 text-sm text-danger'>{promoError}</p>}
          </div>

          <fieldset>
            <legend className='mb-2 text-sm font-medium'>How would you like to pay?</legend>
            <div className='grid grid-cols-2 gap-2'>
              {(
                [
                  {
                    value: 'card',
                    icon: CreditCard,
                    title: 'Pay now',
                    hint: config?.paymentProvider === 'stripe' ? 'Card, Apple & Google Pay' : 'Card (demo)',
                  },
                  { value: 'counter', icon: HandCoins, title: 'Pay later', hint: 'Settle the bill at the end' },
                ] as const
              ).map(({ value, icon: Icon, title, hint }) => (
                <label
                  key={value}
                  className={cn(
                    'pressable relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-3.5 transition-colors',
                    method === value ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line hover:border-line-strong',
                  )}
                >
                  <input
                    type='radio'
                    name='payment'
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className='sr-only'
                  />
                  <Icon className='size-5 text-ink-muted' />
                  <span>
                    <span className='block text-sm font-medium'>{title}</span>
                    <span className='block text-xs text-ink-muted'>{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Sheet>
  );
}
