import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminPageClient } from "@/lib/auth";
import { publicUrl, storageConfig } from "@/lib/storage";
import { deleteGallery } from "../actions";
import { GalleryForm } from "../forms";
import { PhotoManager, type AdminPhoto } from "../photo-manager";
import { Uploader } from "../uploader";
import { field, secondary } from "../ui";

export const metadata: Metadata = { title: "Edit gallery" };

type Variant = { w: number; format: string; key: string };

export default async function EditGallery(props: PageProps<"/admin/portfolio/[id]">) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const [{ data: gallery }, { data: rows }] = await Promise.all([
    supabase.from("portfolio_galleries").select("id, title, slug, category, description, featured, permission_confirmed, published, cover_photo_id").eq("id", id).maybeSingle(),
    supabase.from("portfolio_photos").select("id, alt, featured, filename, width, height, variants").eq("gallery_id", id).order("sort"),
  ]);
  if (!gallery) notFound();
  const storage = Boolean(storageConfig());
  const photos: AdminPhoto[] = (rows ?? []).map((p) => {
    const small = (p.variants as Variant[]).find((v) => v.format === "webp");
    return { id: p.id, alt: p.alt, featured: p.featured, filename: p.filename, width: p.width, height: p.height, thumb: storage && small ? publicUrl(small.key) : null };
  });
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm"><Link href="/admin/portfolio">← All galleries</Link></p>
        <h1 className="text-4xl">{gallery.title}</h1>
        {gallery.published ? <p className="text-sm text-stone">Live at <Link href={`/portfolio/${gallery.slug}`}>/portfolio/{gallery.slug}</Link></p> : <p className="text-sm text-stone">Draft: not visible on the website.</p>}
      </div>
      <GalleryForm gallery={gallery} />
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">Photographs <span className="tnum text-lg text-stone">({photos.length})</span></h2>
        <Uploader galleryId={gallery.id} enabled={storage} />
        <PhotoManager galleryId={gallery.id} photos={photos} coverId={gallery.cover_photo_id} storage={storage} />
      </section>
      <section className="flex flex-col gap-3 border-t border-sand pt-6">
        <h2 className="text-xl">Delete gallery</h2>
        <p className="text-[15px] text-ink-soft">Removes the gallery and all {photos.length} photographs, including the originals in storage. This can&apos;t be undone.</p>
        <form action={deleteGallery} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={gallery.id} />
          <div className="flex flex-col gap-1.5"><label htmlFor="del-confirm" className="text-sm">Type DELETE to confirm</label><input id="del-confirm" name="confirm" required pattern="DELETE" className={`${field} w-48`} autoComplete="off" /></div>
          <button type="submit" className={`${secondary} h-11 border-error text-error`}>Delete gallery</button>
        </form>
      </section>
    </div>
  );
}
