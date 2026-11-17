"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { checkoutExpiry, getStripe, PAYMENT_KINDS, paymentsConfigured, payTokenRe, type PaymentKind } from "@/lib/stripe";

export type PayState = { error?: string };

/** Opens Stripe Checkout for the amount the database holds for this link and payment type. */
export async function startCheckout(_prev: PayState, formData: FormData): Promise<PayState> {
  const token = String(formData.get("token") ?? "");
  const kind = String(formData.get("kind") ?? "") as PaymentKind;
  if (!payTokenRe.test(token) || !PAYMENT_KINDS.includes(kind)) return { error: "This payment link isn't valid." };
  const stripe = getStripe();
  if (!stripe || !paymentsConfigured()) return { error: "Online payment isn't connected yet. Please reply to your approval email to arrange payment." };

  const db = createSupabaseServiceClient();
  const { data, error } = await db.rpc("checkout_details", { token, p_kind: kind });
  const row = (data as { booking_id: string; amount_cents: number; email: string; description: string; pay_by: string | null }[] | null)?.[0];
  if (error || !row) {
    if (error?.message?.includes("NOT_PAYABLE")) return { error: "This payment is no longer due. Reload the page to see the current status." };
    return { error: "This payment link isn't valid. Please use the link in your most recent email." };
  }
  const expiresAt = checkoutExpiry(Date.now(), row.pay_by);
  if (!expiresAt) return { error: "The hold on your date is about to end, so this can't be paid online. Please get in touch." };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: row.amount_cents, product_data: { name: row.description } } }],
        customer_email: row.email,
        client_reference_id: row.booking_id,
        metadata: { booking_id: row.booking_id, kind },
        payment_intent_data: { metadata: { booking_id: row.booking_id, kind }, description: row.description },
        success_url: `${origin}/pay/${token}?paid=1`,
        cancel_url: `${origin}/pay/${token}`,
        expires_at: expiresAt,
      },
      // Double clicks within the same half hour reuse one Checkout page instead of creating two.
      { idempotencyKey: `checkout:${row.booking_id}:${kind}:${row.amount_cents}:${Math.floor(Date.now() / 1_800_000)}` },
    );
    url = session.url;
  } catch {
    return { error: "The payment page couldn't open. Please try again in a moment." };
  }
  if (!url) return { error: "The payment page couldn't open. Please try again in a moment." };
  redirect(url);
}
