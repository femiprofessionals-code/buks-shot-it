import type { Metadata } from "next";
import Link from "next/link";
import { adminPageClient } from "@/lib/auth";
import { storageConfig } from "@/lib/storage";
import { CreateGalleryForm } from "./forms";
import { categoryLabels, type Category } from "./ui";

export const metadata: Metadata = { title: "Portfolio" };

export default async function AdminPortfolio() {
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const { data: galleries } = await supabase
    .from("portfolio_galleries")
    .select("id, title, slug, category, published, featured, updated_at, portfolio_photos(count)")
    .order("sort")
    .order("created_at", { ascending: false });
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Portfolio</h1>
        <p className="text-ink-soft">Galleries shown on the public Portfolio page. A gallery appears on the website only once it is published.</p>
      </div>
      {!storageConfig() ? (
        <p role="status" className="rounded border border-sand bg-white p-4 text-sm text-warning">Photo storage (Cloudflare R2) isn&apos;t connected yet, so photographs can&apos;t be uploaded.</p>
      ) : null}
      <CreateGalleryForm />
      {galleries && galleries.length > 0 ? (
        <table className="w-full border-collapse text-left text-[15px]">
          <thead className="text-[13px] text-stone">
            <tr className="border-b border-sand"><th className="py-2 pr-4 font-normal">Gallery</th><th className="py-2 pr-4 font-normal">Category</th><th className="py-2 pr-4 font-normal">Photos</th><th className="py-2 font-normal">Status</th></tr>
          </thead>
          <tbody>
            {galleries.map((g) => (
              <tr key={g.id} className="border-b border-sand">
                <td className="py-3 pr-4"><Link href={`/admin/portfolio/${g.id}`}>{g.title}</Link></td>
                <td className="py-3 pr-4">{categoryLabels[g.category as Category]}</td>
                <td className="tnum py-3 pr-4">{(g.portfolio_photos as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td className="py-3">{g.published ? "Published" : "Draft"}{g.featured ? " · Featured" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-stone">No galleries yet. Create the first one above.</p>
      )}
    </div>
  );
}
