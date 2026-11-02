import type { OrderStatus } from '@shared/schemas';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone; diner: string }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning', diner: 'Complete payment to send this order to the kitchen.' },
  pending: { label: 'New', tone: 'accent', diner: 'Sent to the kitchen. A chef will pick it up shortly.' },
  preparing: { label: 'Preparing', tone: 'warning', diner: 'The kitchen is cooking your order.' },
  ready: { label: 'Ready', tone: 'success', diner: 'Plated and on its way to your table.' },
  served: { label: 'Served', tone: 'info', diner: 'Enjoy! Wave or tap “Call staff” if you need anything.' },
  completed: { label: 'Completed', tone: 'neutral', diner: 'Paid and complete. Thank you for dining with us.' },
  cancelled: { label: 'Cancelled', tone: 'danger', diner: 'This order was cancelled.' },
};

/** Steps shown on the diner's progress timeline. */
export const DINER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Received' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'served', label: 'Served' },
];

export function stepIndex(status: OrderStatus) {
  if (status === 'completed') return DINER_STEPS.length - 1;
  return DINER_STEPS.findIndex((s) => s.status === status);
}
