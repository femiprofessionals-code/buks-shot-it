import type { Metadata } from "next";
import Link from "next/link";
import { adminPageClient } from "@/lib/auth";
import { fmtDateTime, money, statusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Bookings" };

const views = {
  requests: { label: "New requests", statuses: ["pending"] },
  upcoming: { label: "Upcoming", statuses: ["approved", "awaiting_payment", "confirmed", "rescheduled"] },
  closed: { label: "Past and closed", statuses: ["completed", "declined", "cancelled", "expired"] },
} as const;
type View = keyof typeof views;

type Row = {
  id: string; reference: string; status: string; starts_at: string; full_name: string; service_name: string; package_name: string;
  quantity: number | null; price_type: string; total_cents: number | null; balance_cents: number; is_quote: boolean;
};

export default async function AdminBookings(props: PageProps<"/admin/bookings">) {
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const sp = await props.searchParams;
  const view: View = typeof sp.view === "string" && sp.view in views ? (sp.view as View) : "requests";
  const now = new Date().toISOString();
  let q = supabase
    .from("admin_bookings")
    .select("id, reference, status, starts_at, full_name, service_name, package_name, quantity, price_type, total_cents, balance_cents, is_quote")
    .in("status", [...views[view].statuses]);
  q = view === "closed" ? q.order("starts_at", { ascending: false }).limit(200) : q.order("starts_at", { ascending: true });
  if (view === "upcoming") q = q.gte("starts_at", now);
  const [{ data, error }, { count: pending }] = await Promise.all([
    q,
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const rows = (data ?? []) as Row[];

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl">Bookings</h1>
        <Link href="/admin/availability" className="text-sm">Blocked dates</Link>
      </div>
      <nav aria-label="Booking views" className="flex flex-wrap gap-2 border-b border-sand">
        {(Object.keys(views) as View[]).map((v) => (
          <Link
            key={v}
            href={`/admin/bookings?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm no-underline ${v === view ? "border-charcoal font-medium text-charcoal" : "border-transparent text-stone hover:text-charcoal"}`}
          >
            {views[v].label}
            {v === "requests" && pending ? <span className="ml-2 rounded-full bg-charcoal px-2 py-0.5 text-[11px] text-ivory">{pending}</span> : null}
          </Link>
        ))}
      </nav>
      {error ? <p role="alert" className="text-error">Bookings couldn&apos;t load. Please reload the page.</p> : null}
      {rows.length === 0 && !error ? (
        <p className="text-stone">{view === "requests" ? "No new requests." : view === "upcoming" ? "No upcoming sessions." : "Nothing here yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead className="text-[13px] text-stone">
              <tr className="border-b border-sand">
                <th className="py-2 pr-4 font-normal">Session</th>
                <th className="py-2 pr-4 font-normal">Client</th>
                <th className="py-2 pr-4 font-normal">Package</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 text-right font-normal">Total</th>
                <th className="py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-sand align-top">
                  <td className="py-3 pr-4"><Link href={`/admin/bookings/${r.id}`}>{fmtDateTime(r.starts_at)}</Link><div className="text-xs text-stone">Ref {r.reference}</div></td>
                  <td className="py-3 pr-4">{r.full_name}</td>
                  <td className="py-3 pr-4">{r.service_name.replace(" Photography", "")}: {r.package_name}{r.quantity ? <span className="text-stone"> · {r.quantity} {r.price_type === "hourly" ? "h" : "images"}</span> : null}</td>
                  <td className="py-3 pr-4">{statusLabel[r.status] ?? r.status}</td>
                  <td className="tnum py-3 pr-4 text-right">{r.is_quote && r.total_cents == null ? "Quote" : money(r.total_cents)}</td>
                  <td className="tnum py-3 text-right">{r.total_cents == null ? "—" : money(r.balance_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
