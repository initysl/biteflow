import Stripe from 'stripe';
import type { Order } from '../../shared/schemas';

export interface CheckoutStart {
  /** Where to send the diner to pay; absent for the in-app demo provider. */
  redirectUrl?: string;
}

export interface PaymentProvider {
  name: 'stripe' | 'demo';
  startCheckout(order: Order, opts: { appUrl: string; currency: string; restaurantName: string }): Promise<CheckoutStart>;
  /** Returns the order id if the given checkout session has been paid. */
  confirmCheckout(sessionId: string): Promise<{ orderId: string; ref: string } | null>;
  parseWebhook?(rawBody: Buffer, signature: string): { orderId: string; ref: string } | null;
}

/** No money moves. The client shows a clearly labelled demo confirmation step. */
export const demoProvider: PaymentProvider = {
  name: 'demo',
  async startCheckout() {
    return {};
  },
  async confirmCheckout() {
    return null;
  },
};

export function stripeProvider(secretKey: string, webhookSecret?: string): PaymentProvider {
  const stripe = new Stripe(secretKey);

  const fromSession = (s: Stripe.Checkout.Session) =>
    s.payment_status === 'paid' && s.metadata?.orderId
      ? { orderId: s.metadata.orderId, ref: (typeof s.payment_intent === 'string' ? s.payment_intent : s.id) ?? s.id }
      : null;

  return {
    name: 'stripe',
    async startCheckout(order, { appUrl, currency, restaurantName }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: order.id,
        metadata: { orderId: order.id, tableId: order.tableId },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: order.totalCents,
              product_data: {
                name: `${restaurantName} — order #${order.number}`,
                description: order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ').slice(0, 500),
              },
            },
          },
        ],
        success_url: `${appUrl}/t/${order.tableId}/orders?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/t/${order.tableId}/orders?cancelled=${order.id}`,
      });
      return { redirectUrl: session.url ?? undefined };
    },
    async confirmCheckout(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return fromSession(session);
    },
    parseWebhook: webhookSecret
      ? (rawBody, signature) => {
          const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
          if (event.type !== 'checkout.session.completed') return null;
          return fromSession(event.data.object);
        }
      : undefined,
  };
}
