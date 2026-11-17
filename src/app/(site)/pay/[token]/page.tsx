import type { Metadata } from "next";
import { Suspense } from "react";
import { site } from "@/content/site";
import { publicDb } from "@/lib/booking";
import { supabaseConfigured } from "@/lib/env";
import { fmtDateLong, fmtDateTime, fmtTime, money } from "@/lib/format";
import { paymentsConfigured, payTokenRe } from "@/lib/stripe";
import { PayButtons } from "./pay-buttons";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
  // The link is private: never send it to other sites as a referrer.
  referrer: "no-referrer",
};

type Page = {
  reference: string; first_name: string; service_name: string; package_name: string; quantity: number | null; price_type: string;
  starts_at: string; ends_at: string; status: string; total_cents: number; retainer_cents: number; paid_cents: number; balance_cents: number;
  hold_expires_at: string | null; can_pay_retainer: boolean; can_pay_full: boolean; can_pay_balance: boolean;
};

async function load(token: string): Promise<Page | null> {
  if (!payTokenRe.test(token) || !supabaseConfigured) return null;
  const { data } = await publicDb().rpc("get_payment_page", { token });
  return ((data as Page[] | null) ?? [])[0] ?? null;
}

async function Payment({ params, searchParams }: PageProps<"/pay/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const p = await load(token);

  if (!p) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.02]">This link <em>isn&apos;t active.</em></h1>
        <p className="text-lg text-fg-soft">
          It may have been replaced by a newer link, or mistyped. Please use the link in your most recent email, or contact {site.email}.
        </p>
      </div>
    );
  }

  const returned = sp.paid === "1";
  const confirmed = ["confirmed", "rescheduled", "completed"].includes(p.status);
  const options = [
    p.can_pay_retainer && { kind: "retainer" as const, label: `Pay the retainer · ${money(p.retainer_cents)}`, note: `Reserves your date. The ${money(p.total_cents - p.retainer_cents)} balance is due before delivery.` },
    p.can_pay_full && { kind: "full" as const, label: `Pay in full · ${money(p.total_cents)}`, note: "Nothing more to pay later." },
    p.can_pay_balance && { kind: "balance" as const, label: `Pay the balance · ${money(p.balance_cents)}`, note: "Due before your photographs are delivered." },
  ].filter(Boolean) as { kind: "retainer" | "full" | "balance"; label: string; note: string }[];

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[7fr_5fr]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <p className="label-rule">Payment · Ref {p.reference}</p>
          <h1 className="text-[clamp(2.75rem,6vw,4.75rem)] leading-[1.02] tracking-[-0.015em]">
            {p.first_name ? <>Hello, <em>{p.first_name}.</em></> : <>Your <em>booking</em></>}
          </h1>
        </div>

        {returned ? (
          <p role="status" className="border-l-2 border-ok bg-raised-2 px-4 py-3.5 text-ok">
            {confirmed && p.paid_cents > 0
              ? "Thank you. Your payment is received and your date is confirmed. A confirmation is on its way by email."
              : "Thank you. Your payment is being confirmed, which usually takes a few moments. You'll receive a confirmation by email; there's no need to pay again."}
          </p>
        ) : null}

        {options.length > 0 ? (
          <>
            {p.can_pay_retainer && p.hold_expires_at ? (
              <p className="text-fg-soft">Your date is held until <strong className="font-medium text-ivory">{fmtDateTime(p.hold_expires_at)} ET</strong>. Pay the retainer before then to confirm it.</p>
            ) : null}
            <PayButtons token={token} options={options} enabled={paymentsConfigured()} />
            <ul className="flex list-disc flex-col gap-1.5 border-t border-line pl-5 pt-6 text-[15px] leading-relaxed text-fg-soft">
              <li>The {site.retainerPercent}% retainer is non-refundable.</li>
              <li>The remaining balance is due before your final photographs are delivered.</li>
              <li>Payments are processed securely by Stripe. Card details never reach this website.</li>
            </ul>
          </>
        ) : !returned ? (
          <p className="text-lg text-fg-soft">
            {confirmed && p.balance_cents === 0
              ? "Everything is paid. Thank you."
              : confirmed
                ? "Your date is confirmed. There's nothing to pay right now."
                : p.status === "expired"
                  ? `The hold on this date has ended. Please contact ${site.email} and I'll check whether it's still free.`
                  : `There's nothing to pay on this link. Questions? Email ${site.email}.`}
          </p>
        ) : null}
      </div>

      <aside aria-label="Booking summary" className="border border-line bg-raised p-7">
        <p className="label mb-5">Your booking</p>
        <dl className="flex flex-col gap-3.5 text-[15px]">
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Session</dt><dd>{p.service_name}: {p.package_name}{p.quantity ? ` (${p.quantity} ${p.price_type === "hourly" ? "hours" : "images"})` : ""}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Date</dt><dd>{fmtDateLong(p.starts_at)}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Time</dt><dd className="tnum">{fmtTime(p.starts_at)} – {fmtTime(p.ends_at)} ET</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Total</dt><dd className="tnum font-display text-[28px]">{money(p.total_cents)}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Paid</dt><dd className="tnum">{money(p.paid_cents)}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Balance</dt><dd className="tnum">{money(p.balance_cents)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

export default function PayPage(props: PageProps<"/pay/[token]">) {
  return (
    <section className="wrap pb-32 pt-16 md:pt-24">
      <Suspense fallback={<p className="text-muted">Loading your booking…</p>}>
        <Payment {...props} />
      </Suspense>
    </section>
  );
}
