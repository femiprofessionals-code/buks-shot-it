/**
 * Payment tests. Stripe's own library verifies webhook signatures here for real (offline).
 * The database and the Stripe API are replaced by stand-ins; the database rules themselves are
 * tested in supabase/tests/06_payments.sql. Real Stripe calls need a Stripe test account.
 */
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "example.test" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/lib/stripe", async (orig) => {
  const real = await orig<typeof import("@/lib/stripe")>();
  const realStripe = new Stripe("sk_test_dummy");
  return {
    ...real,
    getStripe: () => ({ webhooks: realStripe.webhooks, checkout: { sessions: { create: sessionsCreate } } }),
  };
});

import { POST } from "@/app/api/stripe/webhook/route";
import { startCheckout } from "@/app/(site)/pay/[token]/actions";
import { checkoutExpiry } from "@/lib/stripe";

const SECRET = "whsec_test_secret";
const BOOKING = "3f0f8a52-1c3e-4c7b-9d0e-2b5f3a7c9e11";
const TOKEN = "a".repeat(64);
const stripe = new Stripe("sk_test_dummy");

function event(type: string, object: Record<string, unknown>, id = "evt_1") {
  return JSON.stringify({ id, object: "event", type, data: { object } });
}
function signed(payload: string, secret = SECRET) {
  return new Request("https://example.test/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) },
  });
}
const paidSession = {
  id: "cs_1",
  object: "checkout.session",
  payment_status: "paid",
  amount_total: 26250,
  currency: "usd",
  payment_intent: "pi_1",
  metadata: { booking_id: BOOKING, kind: "retainer" },
};

beforeEach(() => {
  rpc.mockReset();
  sessionsCreate.mockReset();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});

describe("Stripe webhook", () => {
  it("records a verified, paid Checkout session", async () => {
    rpc.mockResolvedValue({ data: "recorded", error: null });
    const res = await POST(signed(event("checkout.session.completed", paidSession)));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_stripe_payment", expect.objectContaining({
      ev_id: "evt_1", checkout_session: "cs_1", payment_intent: "pi_1", amount: 26250, b_id: BOOKING, p_kind: "retainer",
    }));
  });

  it("rejects a request without a valid signature, and records nothing", async () => {
    const payload = event("checkout.session.completed", paidSession);
    const forged = new Request("https://example.test/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=deadbeef" } });
    expect((await POST(forged)).status).toBe(400);
    expect((await POST(signed(payload, "whsec_wrong_secret"))).status).toBe(400);
    expect((await POST(new Request("https://example.test/api/stripe/webhook", { method: "POST", body: payload }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a signed event whose body was changed afterwards", async () => {
    const payload = event("checkout.session.completed", paidSession);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const tampered = payload.replace("26250", "1");
    const res = await POST(new Request("https://example.test/api/stripe/webhook", { method: "POST", body: tampered, headers: { "stripe-signature": header } }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("waits for delayed payment methods to succeed before recording", async () => {
    rpc.mockResolvedValue({ data: "recorded", error: null });
    await POST(signed(event("checkout.session.completed", { ...paidSession, payment_status: "unpaid" })));
    expect(rpc).not.toHaveBeenCalled();
    await POST(signed(event("checkout.session.async_payment_succeeded", paidSession, "evt_2")));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("ignores events that aren't booking payments", async () => {
    await POST(signed(event("checkout.session.completed", { ...paidSession, metadata: {} })));
    await POST(signed(event("checkout.session.completed", { ...paidSession, currency: "eur" })));
    await POST(signed(event("customer.created", { id: "cus_1", object: "customer" })));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks Stripe to retry when the database can't record", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection lost" } });
    expect((await POST(signed(event("checkout.session.completed", paidSession)))).status).toBe(500);
  });

  it("refuses everything until the webhook secret is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(signed(event("checkout.session.completed", paidSession)))).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

function payForm(kind: string, token = TOKEN) {
  const f = new FormData();
  f.set("token", token);
  f.set("kind", kind);
  return f;
}

describe("opening Stripe Checkout", () => {
  const details = { booking_id: BOOKING, amount_cents: 26250, email: "pat@example.com", description: "Event Photography: Half Day (8 Hours) (AB12CD34) · retainer", pay_by: new Date(Date.now() + 48 * 3600_000).toISOString() };

  it("charges the amount held in the database, never one from the browser", async () => {
    rpc.mockResolvedValue({ data: [details], error: null });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    const f = payForm("retainer");
    f.set("amount", "1"); // ignored
    await expect(startCheckout({}, f)).rejects.toMatchObject({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(rpc).toHaveBeenCalledWith("checkout_details", { token: TOKEN, p_kind: "retainer" });
    const [params, opts] = sessionsCreate.mock.calls[0];
    expect(params.line_items[0].price_data.unit_amount).toBe(26250);
    expect(params.metadata).toEqual({ booking_id: BOOKING, kind: "retainer" });
    expect(params.customer_email).toBe("pat@example.com");
    expect(params.success_url).toBe(`https://example.test/pay/${TOKEN}?paid=1`);
    expect(opts.idempotencyKey).toMatch(/^checkout:/);
  });

  it("never lets the payment page outlive the hold on the date", async () => {
    rpc.mockResolvedValue({ data: [{ ...details, pay_by: new Date(Date.now() + 2 * 3600_000).toISOString() }], error: null });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/x" });
    await startCheckout({}, payForm("retainer")).catch(() => {});
    const expires = sessionsCreate.mock.calls[0][0].expires_at * 1000;
    expect(expires).toBeLessThanOrEqual(Date.now() + 2 * 3600_000);
  });

  it("refuses malformed links and payment types without calling anything", async () => {
    expect((await startCheckout({}, payForm("retainer", "abc"))).error).toBeTruthy();
    expect((await startCheckout({}, payForm("refund"))).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("explains when the payment is no longer due", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "NOT_PAYABLE" } });
    expect((await startCheckout({}, payForm("retainer"))).error).toMatch(/no longer due/);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("says plainly when online payment isn't connected", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await startCheckout({}, payForm("retainer"))).error).toMatch(/isn't connected/);
  });
});

describe("checkout expiry rule", () => {
  const now = Date.UTC(2027, 5, 1, 12);
  it("is at most about 24 hours (Stripe's limit)", () => {
    expect(checkoutExpiry(now, null)).toBe(Math.floor((now + 23.5 * 3600_000) / 1000));
  });
  it("ends a minute before the hold ends", () => {
    expect(checkoutExpiry(now, new Date(now + 3600_000).toISOString())).toBe(Math.floor((now + 3600_000 - 60_000) / 1000));
  });
  it("refuses when under 31 minutes remain (Stripe needs at least 30)", () => {
    expect(checkoutExpiry(now, new Date(now + 30 * 60_000).toISOString())).toBeNull();
  });
});
