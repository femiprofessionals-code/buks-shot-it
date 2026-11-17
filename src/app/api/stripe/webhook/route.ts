import type Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripe, PAYMENT_KINDS, stripeWebhookSecret, type PaymentKind } from "@/lib/stripe";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Stripe webhook. Nothing is trusted until Stripe's signature is verified with the webhook secret.
 * Records a payment only when Checkout reports it paid; the database ignores repeated deliveries.
 * Responds 500 on a database error so Stripe retries later.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) return new Response("Not configured", { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const paidEvent =
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paidEvent) return Response.json({ received: true, ignored: event.type });

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.booking_id ?? "";
  const kind = (session.metadata?.kind ?? "") as PaymentKind;
  if (!uuidRe.test(bookingId) || !PAYMENT_KINDS.includes(kind) || session.currency !== "usd" || !session.amount_total) {
    return Response.json({ received: true, ignored: "not a booking payment" });
  }

  const { data, error } = await createSupabaseServiceClient().rpc("record_stripe_payment", {
    ev_id: event.id,
    ev_type: event.type,
    ev_payload: { session: session.id, amount_total: session.amount_total, payment_status: session.payment_status },
    checkout_session: session.id,
    payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    amount: session.amount_total,
    b_id: bookingId,
    p_kind: kind,
  });
  if (error) return new Response("Could not record", { status: 500 });
  return Response.json({ received: true, result: data });
}
