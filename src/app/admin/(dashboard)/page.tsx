import Link from "next/link";
import { adminPageClient } from "@/lib/auth";

export default async function AdminOverview() {
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const now = new Date().toISOString();
  const [{ count: requests }, { count: upcoming }, { count: galleries }, { count: published }, { count: photos }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", ["approved", "awaiting_payment", "confirmed", "rescheduled"]).gte("starts_at", now),
    supabase.from("portfolio_galleries").select("id", { count: "exact", head: true }),
    supabase.from("portfolio_galleries").select("id", { count: "exact", head: true }).eq("published", true),
    supabase.from("portfolio_photos").select("id", { count: "exact", head: true }),
  ]);
  const tiles = [
    { label: "New booking requests", value: requests ?? 0, href: "/admin/bookings?view=requests" },
    { label: "Upcoming sessions", value: upcoming ?? 0, href: "/admin/bookings?view=upcoming" },
    { label: "Portfolio galleries", value: galleries ?? 0 },
    { label: "Published", value: published ?? 0 },
    { label: "Portfolio photographs", value: photos ?? 0 },
  ];
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-4xl">Overview</h1>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const body = (
            <>
              <span className="text-[13px] text-stone">{t.label}</span>
              <span className="tnum font-display text-4xl font-medium text-charcoal">{t.value}</span>
            </>
          );
          return "href" in t && t.href ? (
            <Link key={t.label} href={t.href} className="flex flex-col gap-1.5 rounded border border-sand bg-white p-5 no-underline hover:border-charcoal">{body}</Link>
          ) : (
            <div key={t.label} className="flex flex-col gap-1.5 rounded border border-sand bg-white p-5">{body}</div>
          );
        })}
      </div>
      <p className="text-ink-soft">Payments, client galleries and enquiries appear here as they are built. <Link href="/admin/portfolio">Manage the portfolio</Link></p>
    </div>
  );
}
