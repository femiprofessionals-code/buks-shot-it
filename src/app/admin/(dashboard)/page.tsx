import Link from "next/link";
import { adminPageClient } from "@/lib/auth";

export default async function AdminOverview() {
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const [{ count: galleries }, { count: published }, { count: photos }] = await Promise.all([
    supabase.from("portfolio_galleries").select("id", { count: "exact", head: true }),
    supabase.from("portfolio_galleries").select("id", { count: "exact", head: true }).eq("published", true),
    supabase.from("portfolio_photos").select("id", { count: "exact", head: true }),
  ]);
  const tiles = [
    { label: "Portfolio galleries", value: galleries ?? 0 },
    { label: "Published", value: published ?? 0 },
    { label: "Portfolio photographs", value: photos ?? 0 },
  ];
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-4xl">Overview</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1.5 rounded border border-sand bg-white p-5">
            <span className="text-[13px] text-stone">{t.label}</span>
            <span className="tnum font-display text-4xl font-medium">{t.value}</span>
          </div>
        ))}
      </div>
      <p className="text-ink-soft">Bookings, payments, client galleries and enquiries appear here as they are built. <Link href="/admin/portfolio">Manage the portfolio</Link></p>
    </div>
  );
}
