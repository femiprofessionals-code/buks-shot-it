import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminPageClient } from "@/lib/auth";
import { fmtDateLong, fmtDateTime, fmtTime, money, statusLabel, toLocalInput } from "@/lib/format";
import { BookingActions } from "./booking-actions";
import { PaymentsPanel } from "./payments-panel";

export const metadata: Metadata = { title: "Booking" };

type Booking = {
  id: string; reference: string; status: string; is_quote: boolean; starts_at: string; ends_at: string; quantity: number | null;
  location: string; details: { notes?: string; addons_requested?: string[] }; total_cents: number | null; retainer_cents: number | null;
  hold_expires_at: string | null; created_at: string; full_name: string; email: string; phone: string | null;
  package_name: string; service_name: string; price_type: string; paid_cents: number; balance_cents: number;
};

export default async function AdminBooking(props: PageProps<"/admin/bookings/[id]">) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const [{ data }, { data: events }, { data: others }, { data: payments }] = await Promise.all([
    supabase.from("admin_bookings").select("*").eq("id", id).maybeSingle(),
    supabase.from("booking_events").select("id, from_status, to_status, at, note").eq("booking_id", id).order("at"),
    supabase.from("admin_bookings").select("id, reference, starts_at, ends_at, status, full_name").neq("id", id)
      .in("status", ["pending", "awaiting_payment", "approved", "confirmed", "rescheduled"]).limit(50),
    supabase.from("admin_payments").select("id, kind, amount_cents, status, method, note, paid_at, created_at").eq("booking_id", id).order("created_at"),
  ]);
  if (!data) notFound();
  const b = data as Booking;
  const sameDay = (others ?? []).filter((o) => fmtDateLong(o.starts_at) === fmtDateLong(b.starts_at));

  const facts: [string, React.ReactNode][] = [
    ["Date", fmtDateLong(b.starts_at)],
    ["Time", `${fmtTime(b.starts_at)} – ${fmtTime(b.ends_at)} ET`],
    ["Package", `${b.service_name}: ${b.package_name}${b.quantity ? ` (${b.quantity} ${b.price_type === "hourly" ? "hours" : "images"})` : ""}`],
    ["Location", b.location],
    ["Total", b.is_quote && b.total_cents == null ? "Quote: set the total when approving" : money(b.total_cents)],
    ["Retainer (35%)", money(b.retainer_cents)],
    ["Paid", money(b.paid_cents)],
    ["Balance", b.total_cents == null ? "—" : money(b.balance_cents)],
  ];
  if (b.hold_expires_at && ["approved", "awaiting_payment"].includes(b.status)) facts.push(["Held until", fmtDateTime(b.hold_expires_at)]);

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm"><Link href="/admin/bookings">← All bookings</Link></p>
        <h1 className="text-4xl">{b.full_name}</h1>
        <p className="text-stone">Ref {b.reference} · {statusLabel[b.status] ?? b.status} · requested {fmtDateTime(b.created_at)}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-6 rounded border border-sand bg-white p-6">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-sm text-stone">{k}</dt>
                <dd className="tnum">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 border-t border-sand pt-5">
            <h2 className="font-sans text-base font-semibold">Client</h2>
            <p><a href={`mailto:${b.email}`}>{b.email}</a>{b.phone ? <> · <a href={`tel:${b.phone}`}>{b.phone}</a></> : null}</p>
          </div>
          {b.details?.notes ? (
            <div className="flex flex-col gap-2 border-t border-sand pt-5">
              <h2 className="font-sans text-base font-semibold">Their notes</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{b.details.notes}</p>
            </div>
          ) : null}
          {b.details?.addons_requested?.length ? (
            <div className="flex flex-col gap-2 border-t border-sand pt-5">
              <h2 className="font-sans text-base font-semibold">Add-ons they&apos;d like</h2>
              <p className="text-[15px]">{b.details.addons_requested.join(", ")}. Include any you agree to in the total.</p>
            </div>
          ) : null}
          {sameDay.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-sand pt-5">
              <h2 className="font-sans text-base font-semibold">Also on this date</h2>
              <ul className="text-[15px]">
                {sameDay.map((o) => (
                  <li key={o.id}><Link href={`/admin/bookings/${o.id}`}>{fmtTime(o.starts_at)}–{fmtTime(o.ends_at)}</Link> · {o.full_name} · {statusLabel[o.status]}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <BookingActions
          id={b.id}
          status={b.status}
          isQuote={b.is_quote}
          totalCents={b.total_cents}
          currentLocal={toLocalInput(b.starts_at)}
        />
      </div>

      <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl">Payments</h2>
          {payments && payments.length > 0 ? (
            <table className="w-full border-collapse text-left text-[15px]">
              <thead className="text-[13px] text-stone"><tr className="border-b border-sand"><th className="py-2 pr-3 font-normal">Date</th><th className="py-2 pr-3 font-normal">For</th><th className="py-2 pr-3 font-normal">How</th><th className="py-2 text-right font-normal">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-sand">
                    <td className="py-2.5 pr-3">{fmtDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="py-2.5 pr-3">{p.kind === "full" ? "Payment in full" : p.kind === "retainer" ? "Retainer" : "Balance"}{p.status !== "succeeded" ? ` (${p.status})` : ""}</td>
                    <td className="py-2.5 pr-3">{p.method === "stripe" ? "Card (Stripe)" : "Recorded manually"}{p.note ? <span className="text-stone"> · {p.note}</span> : null}</td>
                    <td className="tnum py-2.5 text-right">{money(p.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-stone">No payments yet.</p>
          )}
        </div>
        <PaymentsPanel
          id={b.id}
          canRecord={["approved", "awaiting_payment", "expired", "confirmed", "rescheduled", "completed"].includes(b.status) && (b.total_cents ?? 0) > b.paid_cents}
          canLink={(["approved", "awaiting_payment"].includes(b.status) && !!b.hold_expires_at && new Date(b.hold_expires_at) > new Date()) || (["confirmed", "rescheduled", "completed"].includes(b.status) && b.balance_cents > 0)}
          suggestedKind={b.paid_cents > 0 ? "balance" : "retainer"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">History</h2>
        <ol className="flex flex-col gap-1.5 text-[15px]">
          {(events ?? []).map((e) => (
            <li key={e.id}><span className="text-stone">{fmtDateTime(e.at)}</span> · {e.from_status ? `${statusLabel[e.from_status]} → ` : ""}{statusLabel[e.to_status]}{e.note ? ` · ${e.note}` : ""}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
