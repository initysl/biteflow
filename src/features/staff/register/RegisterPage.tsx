import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChefHat,
  Hand,
  MessageSquarePlus,
  PauseCircle,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CATEGORIES, CATEGORY_LABELS, type Category, type Order, type OrderType } from '@shared/schemas';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ORDER_STATUS_META } from '@/lib/orderStatus';
import { queryKeys, useMenu, useMoney, useStaffOrders, useStaffTables } from '@/lib/queries';
import { relativeTime } from '@/lib/time';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Badge, EmptyState, FoodImage, QuantityStepper, Skeleton } from '@/ui/Display';
import { Chip, Input, SearchField, Select, Textarea } from '@/ui/Form';
import { Sheet } from '@/ui/Sheet';
import { KitchenTicketPrint } from './KitchenTicketPrint';
import { useTicket } from './ticketStore';

const PRINT_KEY = 'bf:register:print-kot';

function readPrintPref() {
  try {
    return localStorage.getItem(PRINT_KEY) === 'on';
  } catch {
    return false;
  }
}

function useUpsertOrder() {
  const qc = useQueryClient();
  return (order: Order, { remove = false } = {}) =>
    qc.setQueryData<Order[]>(queryKeys.staffOrders, (prev) => {
      if (!prev) return prev;
      const rest = prev.filter((o) => o.id !== order.id);
      return remove ? rest : [order, ...rest];
    });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function ProductGrid() {
  const { data: menu, isLoading } = useMenu();
  const money = useMoney();
  const { lines, add } = useTicket();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const items = (menu ?? []).filter(
    (m) => (category === 'all' || m.category === category) && (!q || m.name.toLowerCase().includes(q)),
  );
  const qtyFor = (id: string) => lines.filter((l) => l.menuItemId === id).reduce((n, l) => n + l.quantity, 0);

  return (
    <div className='flex min-h-0 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <SearchField
          icon={<Search className='size-[18px]' />}
          placeholder='Search products'
          aria-label='Search products'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='h-11 min-w-52 flex-1'
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
        <div className='grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-4'>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className='h-48' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Search className='size-6' />} title='No products match' />
      ) : (
        <ul className='grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-4'>
          {items.map((m) => {
            const qty = qtyFor(m.id);
            return (
              <li key={m.id}>
                <button
                  type='button'
                  disabled={!m.available}
                  onClick={() => add(m.id)}
                  aria-label={`Add ${m.name}`}
                  className={cn(
                    'pressable relative flex h-full w-full flex-col rounded-[20px] bg-surface p-2 text-left shadow-card transition-shadow',
                    '[@media(hover:hover)]:hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-55',
                    qty > 0 && 'ring-2 ring-accent',
                  )}
                >
                  <FoodImage
                    src={m.imageUrl}
                    alt={m.name}
                    className={cn('aspect-[4/3] w-full rounded-2xl', !m.available && 'grayscale')}
                  />
                  {qty > 0 && (
                    <span className='tabular absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent'>
                      {qty}
                    </span>
                  )}
                  {!m.available && (
                    <span className='absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-canvas'>
                      Sold out
                    </span>
                  )}
                  <span className='mt-2 line-clamp-2 px-1 text-sm leading-snug font-bold'>{m.name}</span>
                  <span className='tabular mt-auto px-1 pt-1 pb-0.5 font-display font-bold text-accent-text'>
                    {money(m.priceCents)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------------

function TicketLineRow({ lineKey }: { lineKey: string }) {
  const { data: menu } = useMenu();
  const money = useMoney();
  const line = useTicket((s) => s.lines.find((l) => l.key === lineKey));
  const { setQuantity, setLineNote } = useTicket();
  const [editing, setEditing] = useState(false);
  if (!line) return null;
  const item = menu?.find((m) => m.id === line.menuItemId);
  const name = item?.name ?? 'Unavailable item';
  const price = item?.priceCents ?? 0;

  return (
    <li className='rounded-2xl bg-surface-2 p-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='leading-snug font-bold'>{name}</p>
          <p className='tabular text-sm font-bold text-accent-text'>
            {money(price)} × {line.quantity} = {money(price * line.quantity)}
          </p>
        </div>
        <QuantityStepper size='sm' value={line.quantity} onChange={(v) => setQuantity(line.key, v)} label={name} />
      </div>
      {editing ? (
        <Input
          autoFocus
          maxLength={140}
          defaultValue={line.note}
          placeholder='e.g. no onions, extra sauce'
          aria-label={`Note for ${name}`}
          onBlur={(e) => {
            setLineNote(line.key, e.target.value.trim());
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className='mt-2 h-10 bg-surface'
        />
      ) : line.note ? (
        <button
          type='button'
          onClick={() => setEditing(true)}
          className='mt-1.5 text-left text-sm font-semibold text-accent-text'
        >
          → {line.note}
        </button>
      ) : (
        <button
          type='button'
          onClick={() => setEditing(true)}
          className='mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-ink'
        >
          <MessageSquarePlus className='size-3.5' /> Add note
        </button>
      )}
    </li>
  );
}

function TicketPanel({ onDone }: { onDone?: () => void }) {
  const ticket = useTicket();
  const { data: menu } = useMenu();
  const { data: tables } = useStaffTables();
  const money = useMoney();
  const upsert = useUpsertOrder();
  const [printKot, setPrintKot] = useState(readPrintPref);
  const [printing, setPrinting] = useState<Order | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showNotes, setShowNotes] = useState(!!ticket.notes);

  const count = ticket.lines.reduce((n, l) => n + l.quantity, 0);
  const total = ticket.lines.reduce((s, l) => s + (menu?.find((m) => m.id === l.menuItemId)?.priceCents ?? 0) * l.quantity, 0);
  const needsTable = ticket.type === 'dine_in' && !ticket.tableId;
  const selectedTable = tables?.find((t) => t.id === ticket.tableId);

  const save = useMutation({
    mutationFn: (action: 'hold' | 'send') =>
      api<Order>('/staff/pos/orders', {
        method: 'POST',
        body: {
          orderId: ticket.orderId,
          type: ticket.type,
          tableId: ticket.type === 'dine_in' ? ticket.tableId : undefined,
          customerName: ticket.type === 'takeaway' ? ticket.customerName || undefined : undefined,
          items: ticket.lines.map(({ menuItemId, quantity, note }) => ({ menuItemId, quantity, note })),
          notes: ticket.notes || undefined,
          action,
        },
      }),
    onSuccess: (order, action) => {
      upsert(order);
      ticket.clear();
      setShowNotes(false);
      onDone?.();
      if (action === 'hold') {
        toast(`Order #${order.number} held`, { description: 'Recall it from Held orders when you’re ready.' });
      } else {
        toast.success(`Order #${order.number} sent to the kitchen`);
        if (printKot) setPrinting(order);
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setType = (type: OrderType) => ticket.setType(type);

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center justify-between gap-2 px-5 pt-5'>
        <div>
          <p className='text-xs font-bold text-ink-muted'>{ticket.orderId ? 'Recalled ticket' : 'Current ticket'}</p>
          <h2 className='font-display text-2xl font-bold'>{ticket.orderId ? `Order #${ticket.number}` : 'New order'}</h2>
        </div>
        {ticket.lines.length > 0 && (
          <Button variant='ghost' size='sm' onClick={() => setConfirmClear(true)}>
            <Trash2 className='size-4' /> Clear
          </Button>
        )}
      </div>

      <div className='space-y-3 px-5 pt-4'>
        <div role='radiogroup' aria-label='Order type' className='grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1'>
          {(
            [
              ['dine_in', 'Dine-in', Utensils],
              ['takeaway', 'Takeaway', ShoppingBag],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type='button'
              role='radio'
              aria-checked={ticket.type === value}
              onClick={() => setType(value)}
              className={cn(
                'pressable flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition-colors',
                ticket.type === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon className='size-4' /> {label}
            </button>
          ))}
        </div>
        {ticket.type === 'dine_in' ? (
          <Select aria-label='Table' value={ticket.tableId ?? ''} onChange={(e) => ticket.setTable(e.target.value || undefined)}>
            <option value=''>Choose a table…</option>
            {tables?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.status === 'vacant' ? ' · vacant' : ` · open ${money(t.openTotalCents)}`}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            aria-label='Customer name'
            placeholder='Customer name (optional)'
            maxLength={40}
            value={ticket.customerName}
            onChange={(e) => ticket.setCustomerName(e.target.value)}
          />
        )}
        {selectedTable && selectedTable.openTotalCents > 0 && ticket.type === 'dine_in' && (
          <p className='text-xs font-semibold text-ink-muted'>
            Adds to {selectedTable.label}’s open bill ({money(selectedTable.openTotalCents)} so far).
          </p>
        )}
      </div>

      <div className='mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5'>
        {ticket.lines.length === 0 ? (
          <EmptyState className='py-10' icon={<Receipt className='size-6' />} title='Empty ticket'>
            Tap products to add them.
          </EmptyState>
        ) : (
          <ul className='space-y-2 pb-2'>
            {ticket.lines.map((l) => (
              <TicketLineRow key={l.key} lineKey={l.key} />
            ))}
          </ul>
        )}
        {ticket.lines.length > 0 &&
          (showNotes ? (
            <Textarea
              rows={2}
              maxLength={280}
              aria-label='Order note'
              placeholder='Note for the whole order — allergies, timing…'
              value={ticket.notes}
              onChange={(e) => ticket.setNotes(e.target.value)}
              className='mb-3'
            />
          ) : (
            <button
              type='button'
              onClick={() => setShowNotes(true)}
              className='mb-3 inline-flex items-center gap-1 text-sm font-bold text-ink-muted hover:text-ink'
            >
              <MessageSquarePlus className='size-4' /> Add order note
            </button>
          ))}
      </div>

      <div className='space-y-3 border-t border-line px-5 pt-4 pb-5'>
        <div className='flex items-baseline justify-between'>
          <span className='text-sm font-semibold text-ink-muted'>
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          <span className='tabular font-display text-3xl font-bold'>{money(total)}</span>
        </div>
        <label className='flex items-center gap-2 text-sm font-semibold text-ink-muted'>
          <input
            type='checkbox'
            checked={printKot}
            onChange={(e) => {
              setPrintKot(e.target.checked);
              try {
                localStorage.setItem(PRINT_KEY, e.target.checked ? 'on' : 'off');
              } catch {
                /* ignore */
              }
            }}
            className='size-4 accent-[var(--accent)]'
          />
          <Printer className='size-4' /> Print kitchen ticket when sending
        </label>
        {needsTable && ticket.lines.length > 0 && (
          <p className='text-sm font-semibold text-warning'>Choose a table to send a dine-in order.</p>
        )}
        <div className='grid grid-cols-[auto_1fr] gap-2'>
          <Button
            variant='secondary'
            size='lg'
            disabled={ticket.lines.length === 0 || needsTable || save.isPending}
            loading={save.isPending && save.variables === 'hold'}
            onClick={() => save.mutate('hold')}
          >
            <PauseCircle className='size-[18px]' /> Hold
          </Button>
          <Button
            size='lg'
            disabled={ticket.lines.length === 0 || needsTable || save.isPending}
            loading={save.isPending && save.variables === 'send'}
            onClick={() => save.mutate('send')}
          >
            <ChefHat className='size-[18px]' /> Send to kitchen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={ticket.orderId ? `Stop editing order #${ticket.number}?` : 'Clear this ticket?'}
        confirmLabel='Clear ticket'
        tone='danger'
        onConfirm={() => {
          ticket.clear();
          setShowNotes(false);
          setConfirmClear(false);
        }}
      >
        {ticket.orderId
          ? 'The held order stays in Held orders — only your unsaved changes are lost.'
          : 'Nothing has been sent to the kitchen yet.'}
      </ConfirmDialog>
      {printing && <KitchenTicketPrint order={printing} onDone={() => setPrinting(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Held tickets and takeaway queue
// ---------------------------------------------------------------------------

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function orderLabel(o: Order) {
  return o.type === 'takeaway' ? `Takeaway${o.customerName ? ` · ${o.customerName}` : ''}` : `Table ${o.tableId}`;
}

function HeldSheet({ open, onOpenChange, orders }: { open: boolean; onOpenChange: (v: boolean) => void; orders: Order[] }) {
  const money = useMoney();
  const upsert = useUpsertOrder();
  const ticket = useTicket();
  const [replacing, setReplacing] = useState<Order | null>(null);
  const discard = useMutation({
    mutationFn: (id: string) => api<Order>(`/staff/pos/orders/${id}`, { method: 'DELETE' }),
    onSuccess: (order) => {
      upsert(order, { remove: true });
      if (ticket.orderId === order.id) ticket.clear();
      toast(`Held order #${order.number} discarded`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const recall = (o: Order) => {
    ticket.recall(o);
    setReplacing(null);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title='Held orders'
        description='Parked tickets that haven’t gone to the kitchen.'
      >
        <div className='space-y-2 px-5 pt-4 pb-6'>
          {orders.length === 0 ? (
            <EmptyState icon={<PauseCircle className='size-6' />} title='Nothing on hold'>
              Use Hold on the ticket to park an order without sending it.
            </EmptyState>
          ) : (
            orders.map((o) => (
              <div key={o.id} className='rounded-2xl border border-line p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='font-bold'>
                      #{o.number} · {orderLabel(o)}
                    </p>
                    <p className='text-sm text-ink-muted'>
                      {plural(
                        o.items.reduce((n, i) => n + i.quantity, 0),
                        'item',
                      )}{' '}
                      · held {relativeTime(o.createdAt)}
                      {o.staffName && ` by ${o.staffName}`}
                    </p>
                  </div>
                  <span className='tabular font-display text-lg font-bold'>{money(o.totalCents)}</span>
                </div>
                <div className='mt-3 flex justify-end gap-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-danger hover:text-danger'
                    loading={discard.isPending && discard.variables === o.id}
                    onClick={() => discard.mutate(o.id)}
                  >
                    Discard
                  </Button>
                  <Button
                    variant='dark'
                    size='sm'
                    onClick={() => (ticket.lines.length > 0 && ticket.orderId !== o.id ? setReplacing(o) : recall(o))}
                  >
                    Recall
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!replacing}
        onOpenChange={(v) => !v && setReplacing(null)}
        title='Replace the current ticket?'
        confirmLabel='Recall order'
        onConfirm={() => replacing && recall(replacing)}
      >
        The ticket you’re working on hasn’t been held or sent, so it will be lost.
      </ConfirmDialog>
    </>
  );
}

function TakeawaySheet({ open, onOpenChange, orders }: { open: boolean; onOpenChange: (v: boolean) => void; orders: Order[] }) {
  const money = useMoney();
  const upsert = useUpsertOrder();
  const pay = useMutation({
    mutationFn: (id: string) => api<Order>(`/staff/orders/${id}/pay`, { method: 'POST' }),
    onSuccess: (order) => {
      upsert(order);
      toast.success(`Order #${order.number} paid`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title='Takeaway' description='Orders waiting for payment or pickup.'>
      <div className='space-y-2 px-5 pt-4 pb-6'>
        {orders.length === 0 ? (
          <EmptyState icon={<ShoppingBag className='size-6' />} title='No open takeaway orders' />
        ) : (
          orders.map((o) => {
            const meta = ORDER_STATUS_META[o.status];
            return (
              <div key={o.id} className='flex items-center gap-3 rounded-2xl border border-line p-4'>
                <div className='min-w-0 flex-1'>
                  <p className='truncate font-bold'>
                    #{o.number} · {o.customerName ?? 'Takeaway'}
                  </p>
                  <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                    <Badge tone={meta.tone}>{o.status === 'served' ? 'Picked up' : meta.label}</Badge>
                    <Badge tone={o.paymentStatus === 'paid' ? 'success' : 'neutral'}>
                      {o.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </div>
                </div>
                <span className='tabular font-display text-lg font-bold'>{money(o.totalCents)}</span>
                {o.paymentStatus === 'unpaid' && (
                  <Button size='sm' loading={pay.isPending && pay.variables === o.id} onClick={() => pay.mutate(o.id)}>
                    Take payment
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function RegisterPage() {
  const { data: orders } = useStaffOrders();
  const money = useMoney();
  const { data: menu } = useMenu();
  const lines = useTicket((s) => s.lines);
  const [heldOpen, setHeldOpen] = useState(false);
  const [takeawayOpen, setTakeawayOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  const held = useMemo(() => (orders ?? []).filter((o) => o.status === 'held'), [orders]);
  const takeaway = useMemo(
    () => (orders ?? []).filter((o) => o.type === 'takeaway' && !['held', 'completed', 'cancelled'].includes(o.status)),
    [orders],
  );
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((s, l) => s + (menu?.find((m) => m.id === l.menuItemId)?.priceCents ?? 0) * l.quantity, 0);

  return (
    <div className='flex flex-col @4xl/main:h-[calc(100dvh-4rem)] @4xl/main:flex-row'>
      <section
        aria-label='Products'
        className='@container flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 @4xl/main:overflow-y-auto pt-5 pb-4 sm:px-6 @4xl/main:pb-8'
      >
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='font-display text-3xl font-bold'>Register</h1>
            <p className='text-ink-muted'>Ring up dine-in and takeaway orders.</p>
          </div>
          <div className='flex gap-2'>
            <Button variant='secondary' onClick={() => setHeldOpen(true)}>
              <PauseCircle className='size-4' /> Held
              {held.length > 0 && (
                <span className='tabular rounded-full bg-highlight px-2 text-xs text-on-highlight'>{held.length}</span>
              )}
            </Button>
            <Button variant='secondary' onClick={() => setTakeawayOpen(true)}>
              <Hand className='size-4' /> Takeaway
              {takeaway.length > 0 && (
                <span className='tabular rounded-full bg-ink px-2 text-xs text-canvas'>{takeaway.length}</span>
              )}
            </Button>
          </div>
        </div>
        <ProductGrid />

        {/* On narrow screens the ticket opens as a sheet from this bar. */}
        <div className='sticky bottom-4 z-10 mt-auto @4xl/main:hidden'>
          <button
            type='button'
            onClick={() => setTicketOpen(true)}
            className='pressable mx-auto flex h-16 w-full max-w-md items-center gap-3 rounded-full bg-accent pr-6 pl-2 text-on-accent shadow-glow'
          >
            <span className='flex size-12 items-center justify-center rounded-full bg-on-accent/15'>
              <Receipt className='size-5' />
            </span>
            <span className='flex-1 text-left font-bold'>View ticket</span>
            <span className='tabular rounded-full bg-on-accent px-2.5 py-0.5 text-xs font-extrabold text-accent'>{count}</span>
            <span className='tabular font-display text-lg font-bold'>{money(total)}</span>
          </button>
        </div>
      </section>

      {/* Ticket: a side panel when there's room, otherwise a sheet. */}
      <aside aria-label='Ticket' className='hidden w-[380px] shrink-0 border-l border-line bg-surface @4xl/main:block'>
        <TicketPanel />
      </aside>

      <Sheet open={ticketOpen} onOpenChange={setTicketOpen} title='Ticket' hideTitle>
        <TicketPanel onDone={() => setTicketOpen(false)} />
      </Sheet>

      <HeldSheet open={heldOpen} onOpenChange={setHeldOpen} orders={held} />
      <TakeawaySheet open={takeawayOpen} onOpenChange={setTakeawayOpen} orders={takeaway} />
    </div>
  );
}
