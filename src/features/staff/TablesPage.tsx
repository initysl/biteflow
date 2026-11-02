import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, MoreHorizontal, Pencil, Plus, Printer, RefreshCcw, Trash2, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { TableWithToken } from '@shared/schemas';
import { tableInputSchema } from '@shared/validation';
import { api, errorMessage } from '@/lib/api';
import { queryKeys, useConfig, useStaffTables } from '@/lib/queries';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Card, Skeleton } from '@/ui/Display';
import { Field, Input } from '@/ui/Form';
import { Dialog } from '@/ui/Sheet';
import { PageHeader } from './StaffLayout';

function useTableUrl() {
  const { data: config } = useConfig();
  const base = config?.appUrl && !config.appUrl.includes('localhost') ? config.appUrl : window.location.origin;
  return (t: TableWithToken) => `${base}/t/${encodeURIComponent(t.id)}?k=${encodeURIComponent(t.token)}`;
}

function useQrDataUrl(text: string, width = 320) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { width, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1f1b16', light: '#ffffff' } })
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [text, width]);
  return url;
}

function QrImage({ text, className }: { text: string; className?: string }) {
  const url = useQrDataUrl(text);
  return url ? <img src={url} alt='' className={className} /> : <Skeleton className={className} />;
}

async function downloadQr(table: TableWithToken, text: string) {
  const url = await QRCode.toDataURL(text, { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
  const a = document.createElement('a');
  a.href = url;
  a.download = `${table.label.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
  a.click();
}

function TableCard({
  table,
  onEdit,
  onRotate,
  onDelete,
}: {
  table: TableWithToken;
  onEdit: () => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const tableUrl = useTableUrl();
  const url = tableUrl(table);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Card className='flex flex-col p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h3 className='font-display text-xl font-semibold'>{table.label}</h3>
          <p className='flex items-center gap-1.5 text-sm text-ink-muted'>
            <Users className='size-3.5' /> {table.seats} seats
          </p>
        </div>
        <div className='relative'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={`More actions for ${table.label}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className='size-4.5' />
          </Button>
          {menuOpen && (
            <>
              <div className='fixed inset-0 z-10' onClick={() => setMenuOpen(false)} />
              <div
                role='menu'
                className='animate-arrive absolute top-10 right-0 z-20 w-52 origin-top-right rounded-xl border border-line bg-surface p-1 shadow-float'
              >
                {[
                  { icon: Pencil, label: 'Edit details', run: onEdit },
                  { icon: RefreshCcw, label: 'Regenerate QR code', run: onRotate },
                  { icon: Trash2, label: 'Remove table', run: onDelete, danger: true },
                ].map(({ icon: Icon, label, run, danger }) => (
                  <button
                    key={label}
                    role='menuitem'
                    type='button'
                    onClick={() => {
                      setMenuOpen(false);
                      run();
                    }}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-2 ${danger ? 'text-danger' : ''}`}
                  >
                    <Icon className='size-4' /> {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className='mx-auto my-4 rounded-2xl bg-white p-3 shadow-card'>
        <QrImage text={url} className='size-36' />
      </div>
      <div className='mt-auto grid grid-cols-2 gap-2'>
        <Button variant='secondary' size='sm' onClick={() => downloadQr(table, url)}>
          <Download className='size-4' /> PNG
        </Button>
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className='pressable inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-ink'
        >
          <ExternalLink className='size-4' /> Open
        </a>
      </div>
    </Card>
  );
}

function TableDialog({
  open,
  table,
  onOpenChange,
}: {
  open: boolean;
  table: TableWithToken | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [seats, setSeats] = useState('4');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setId(table?.id ?? '');
    setLabel(table?.label ?? '');
    setSeats(String(table?.seats ?? 4));
    setError(null);
  }, [open, table]);

  const save = useMutation({
    mutationFn: () => {
      const body = { id: id.trim(), label: label.trim() || `Table ${id.trim()}`, seats: Number(seats) };
      const parsed = tableInputSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the details');
      return table
        ? api<TableWithToken>(`/staff/tables/${table.id}`, { method: 'PATCH', body: { label: body.label, seats: body.seats } })
        : api<TableWithToken>('/staff/tables', { method: 'POST', body });
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: queryKeys.staffTables });
      toast.success(table ? `Saved ${t.label}` : `${t.label} added`);
      onOpenChange(false);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={table ? `Edit ${table.label}` : 'Add a table'}
      footer={
        <>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='table-form' loading={save.isPending}>
            {table ? 'Save' : 'Add table'}
          </Button>
        </>
      }
    >
      <form
        id='table-form'
        className='space-y-4'
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {!table && (
          <Field label='Table number' hint='Used in the QR link, e.g. 12 or patio-3'>
            {(p) => <Input {...p} value={id} onChange={(e) => setId(e.target.value)} autoFocus maxLength={16} />}
          </Field>
        )}
        <div className='grid grid-cols-[1fr_100px] gap-4'>
          <Field label='Display name'>
            {(p) => (
              <Input
                {...p}
                value={label}
                placeholder={id ? `Table ${id}` : 'Table 12'}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={40}
              />
            )}
          </Field>
          <Field label='Seats'>
            {(p) => <Input {...p} type='number' min={1} max={40} value={seats} onChange={(e) => setSeats(e.target.value)} />}
          </Field>
        </div>
        {error && <p className='text-sm text-danger'>{error}</p>}
      </form>
    </Dialog>
  );
}

/** Rendered only while printing: one table tent card per table. */
function PrintSheet({ tables, restaurantName }: { tables: TableWithToken[]; restaurantName: string }) {
  const tableUrl = useTableUrl();
  return createPortal(
    <div id='qr-sheet' className='grid grid-cols-2 gap-6 bg-white p-6 text-black'>
      {tables.map((t) => (
        <div
          key={t.id}
          className='flex break-inside-avoid flex-col items-center rounded-2xl border border-black/20 p-6 text-center'
        >
          <p className='font-display text-2xl font-semibold'>{restaurantName}</p>
          <p className='mt-1 text-sm'>Scan to order & pay</p>
          <QrImage text={tableUrl(t)} className='my-4 size-48' />
          <p className='font-display text-3xl font-semibold'>{t.label}</p>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function TablesPage() {
  const qc = useQueryClient();
  const { data: tables, isLoading } = useStaffTables();
  const { data: config } = useConfig();
  const [dialog, setDialog] = useState<{ open: boolean; table: TableWithToken | null }>({ open: false, table: null });
  const [rotating, setRotating] = useState<TableWithToken | null>(null);
  const [deleting, setDeleting] = useState<TableWithToken | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Give the QR images a moment to render before opening the print dialog.
    const t = setTimeout(() => window.print(), 400);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const rotate = useMutation({
    mutationFn: (id: string) => api<TableWithToken>(`/staff/tables/${id}/rotate-token`, { method: 'POST' }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: queryKeys.staffTables });
      toast.success(`New QR code for ${t.label}`, { description: 'Reprint it — the old code no longer works.' });
      setRotating(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/staff/tables/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staffTables });
      toast.success(`${deleting?.label} removed`);
      setDeleting(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title='Tables & QR codes'
        description='Each table has its own code. Print them as table tents or download for your designer.'
        actions={
          <>
            <Button variant='secondary' disabled={!tables?.length} onClick={() => setPrinting(true)}>
              <Printer className='size-4' /> Print all
            </Button>
            <Button onClick={() => setDialog({ open: true, table: null })}>
              <Plus className='size-4' /> Add table
            </Button>
          </>
        }
      />

      <div className='grid gap-4 px-4 pb-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 2xl:grid-cols-4'>
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className='h-80' />)
          : tables?.map((t) => (
              <TableCard
                key={t.id}
                table={t}
                onEdit={() => setDialog({ open: true, table: t })}
                onRotate={() => setRotating(t)}
                onDelete={() => setDeleting(t)}
              />
            ))}
      </div>

      <TableDialog open={dialog.open} table={dialog.table} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <ConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title={`Regenerate QR for ${rotating?.label ?? ''}?`}
        confirmLabel='Regenerate'
        tone='danger'
        loading={rotate.isPending}
        onConfirm={() => rotating && rotate.mutate(rotating.id)}
      >
        The printed code on the table will stop working immediately. Use this if a code has been shared outside the restaurant.
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.label ?? ''}?`}
        confirmLabel='Remove'
        tone='danger'
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        Its QR code stops working and its order history is deleted. Tables with open orders can’t be removed.
      </ConfirmDialog>

      {printing && tables && <PrintSheet tables={tables} restaurantName={config?.restaurantName ?? ''} />}
    </div>
  );
}
