import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabaseConfigured } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { publicUrl, storageConfig } from "@/lib/storage";
import type { ServiceSlug } from "@/content/services";

export const PORTFOLIO_TAG = "portfolio";

const toSlug: Record<string, ServiceSlug> = { wedding: "weddings", portrait: "portraits", event: "events", product: "products" };

export type RemotePhoto = {
  kind: "remote";
  id: string;
  alt: string;
  width: number;
  height: number;
  src: string;      // JPEG fallback
  srcSet: string;   // WebP sizes
  largest: string;  // biggest WebP, for the full-screen viewer
  blur: string | null;
  category: ServiceSlug;
  featured: boolean;
  isCover: boolean;
  gallerySlug: string;
  galleryTitle: string;
};

export type PublicGallery = {
  slug: string;
  title: string;
  category: ServiceSlug;
  description: string | null;
  featured: boolean;
  photos: RemotePhoto[];
  cover: RemotePhoto;
};

type Row = {
  gallery_id: string; slug: string; title: string; category: string; description: string | null; gallery_featured: boolean; gallery_sort: number;
  photo_id: string; alt: string; width: number; height: number; variants: { w: number; h: number; format: string; key: string }[];
  blur_data_url: string | null; photo_featured: boolean; photo_sort: number; is_cover: boolean;
};

/** Published galleries from the database. Null until Supabase and storage are connected and something is published. */
export async function getPublicPortfolio(): Promise<PublicGallery[] | null> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheLife("hours");
  if (!supabaseConfigured || !storageConfig()) return null;
  const { data, error } = await createSupabasePublicClient()
    .from("public_portfolio")
    .select("*")
    .order("gallery_sort")
    .order("photo_sort");
  if (error || !data || data.length === 0) return null;

  const byGallery = new Map<string, PublicGallery>();
  for (const r of data as Row[]) {
    const webp = r.variants.filter((v) => v.format === "webp").sort((a, b) => a.w - b.w);
    const jpeg = r.variants.find((v) => v.format === "jpeg") ?? webp.at(-1);
    if (!jpeg || webp.length === 0) continue;
    const photo: RemotePhoto = {
      kind: "remote",
      id: r.photo_id,
      alt: r.alt,
      width: r.width,
      height: r.height,
      src: publicUrl(jpeg.key),
      srcSet: webp.map((v) => `${publicUrl(v.key)} ${v.w}w`).join(", "),
      largest: publicUrl(webp.at(-1)!.key),
      blur: r.blur_data_url,
      category: toSlug[r.category],
      featured: r.photo_featured,
      isCover: r.is_cover,
      gallerySlug: r.slug,
      galleryTitle: r.title,
    };
    const g = byGallery.get(r.gallery_id);
    if (g) {
      g.photos.push(photo);
      if (photo.isCover) g.cover = photo;
    } else {
      byGallery.set(r.gallery_id, {
        slug: r.slug, title: r.title, category: toSlug[r.category], description: r.description, featured: r.gallery_featured,
        photos: [photo], cover: photo,
      });
    }
  }
  // Featured galleries first, otherwise in the admin order.
  return [...byGallery.values()].sort((a, b) => Number(b.featured) - Number(a.featured));
}
