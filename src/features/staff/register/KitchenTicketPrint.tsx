import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Order } from '@shared/schemas';
import { STATION_LABELS } from '@shared/schemas';
import { clockTime } from '@/lib/time';

/**
 * A narrow kitchen order ticket (KOT) for thermal printers. Rendered only while
 * printing; `onDone` fires once the print dialog closes.
 */
export function KitchenTicketPrint({ order, onDone }: { order: Order; onDone: () => void }) {
  useEffect(() => {
    window.addEventListener('afterprint', onDone, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', onDone);
    };
  }, [onDone]);

  const where =
    order.type === 'takeaway' ? `TAKEAWAY${order.customerName ? ` · ${order.customerName}` : ''}` : `TABLE ${order.tableId}`;

  return createPortal(
    <div id='kot-sheet' className='font-mono text-[13px] leading-snug text-black'>
      <p className='text-center text-[11px] tracking-[0.2em]'>KITCHEN ORDER</p>
      <p className='mt-1 text-center text-2xl font-bold'>#{order.number}</p>
      <p className='text-center text-lg font-bold'>{where}</p>
      <p className='mt-1 text-center text-[11px]'>
        {clockTime(order.createdAt)}
        {order.staffName && ` · ${order.staffName}`}
      </p>
      <hr className='my-2 border-dashed border-black' />
      <ul className='space-y-1.5'>
        {order.items.map((i) => (
          <li key={i.id}>
            <div className='flex gap-2 font-bold'>
              <span className='w-6 shrink-0'>{i.quantity}×</span>
              <span>{i.name}</span>
            </div>
            <div className='pl-8 text-[11px]'>{STATION_LABELS[i.station]}</div>
            {i.note && <div className='pl-8 font-bold'>** {i.note}</div>}
          </li>
        ))}
      </ul>
      {order.notes && (
        <>
          <hr className='my-2 border-dashed border-black' />
          <p className='font-bold'>NOTE: {order.notes}</p>
        </>
      )}
      <hr className='my-2 border-dashed border-black' />
    </div>,
    document.body,
  );
}
