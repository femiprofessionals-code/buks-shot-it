import "server-only";
import Stripe from "stripe";

/** Stripe client (server only). Null until STRIPE_SECRET_KEY is set. */
let client: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "buks-shot-it" } });
  return client;
}

export const stripeWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const paymentsConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const payTokenRe = /^[0-9a-f]{64}$/;
export const PAYMENT_KINDS = ["retainer", "full", "balance"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/**
 * When a Checkout page must expire: Stripe allows 30 minutes to 24 hours. A retainer link
 * never outlives the 72-hour hold on the date (payBy). Null when there isn't enough time left.
 */
export function checkoutExpiry(now: number, payBy: string | null): number | null {
  const max = now + 23.5 * 3600_000;
  const end = payBy ? Math.min(new Date(payBy).getTime() - 60_000, max) : max;
  if (end < now + 31 * 60_000) return null;
  return Math.floor(end / 1000);
}
