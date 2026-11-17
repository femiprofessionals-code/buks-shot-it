"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { processImage } from "@/lib/image-processing";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  getObjectBytes,
  newKey,
  presignUpload,
  putObject,
  storageConfig,
} from "@/lib/storage";
import { PORTFOLIO_TAG } from "@/lib/portfolio";

const categories = ["wedding", "portrait", "event", "product"] as const;
const uuid = z.string().uuid();

export type ActionResult = { ok: boolean; error?: string };

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "gallery";
}

function friendly(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("portfolio_galleries_slug_key") || m.includes("duplicate key")) return "That web address is already used by another gallery.";
  if (m.includes("portfolio_slug_not_category")) return "That web address is reserved for a category page. Choose another.";
  if (m.includes("portfolio_slug_format")) return "Web addresses can use lowercase letters, numbers and hyphens only.";
  if (m.includes("permission_confirmed") || m.includes("check constraint")) return "Confirm you have the client's permission before publishing.";
  if (m.includes("COVER_NOT_IN_GALLERY")) return "The cover must be one of this gallery's photos.";
  if (m.includes("INVALID_ORDER")) return "The photo order changed in another window. Reload and try again.";
  return "Something went wrong. Please try again.";
}

function done() {
  updateTag(PORTFOLIO_TAG);
}

// ---------------------------------------------------------------- galleries

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the gallery a title.").max(120),
  category: z.enum(categories),
});

export async function createGallery(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const parsed = createSchema.safeParse({ title: formData.get("title"), category: formData.get("category") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  let slug = slugify(parsed.data.title);
  if (["weddings", "portraits", "events", "products", "all"].includes(slug)) slug = `${slug}-gallery`;
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data, error } = await supabase
      .from("portfolio_galleries")
      .insert({ title: parsed.data.title, category: parsed.data.category, slug: candidate })
      .select("id")
      .single();
    if (!error && data) {
      done();
      redirect(`/admin/portfolio/${data.id}`);
    }
    if (error && !error.message.includes("duplicate key")) return { ok: false, error: friendly(error) };
  }
  return { ok: false, error: "Couldn't find a free web address for that title. Try a different title." };
}

const updateSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1, "Give the gallery a title.").max(120),
  slug: z.string().trim().min(1).max(80),
  category: z.enum(categories),
  description: z.string().trim().max(1000).optional(),
  featured: z.boolean(),
  permission_confirmed: z.boolean(),
  published: z.boolean(),
});

export async function updateGallery(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    category: formData.get("category"),
    description: formData.get("description") ?? undefined,
    featured: formData.get("featured") === "on",
    permission_confirmed: formData.get("permission_confirmed") === "on",
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { id, ...fields } = parsed.data;
  if (fields.published && !fields.permission_confirmed) {
    return { ok: false, error: "Confirm you have the client's permission before publishing." };
  }
  if (fields.published) {
    const { count } = await supabase.from("portfolio_photos").select("id", { count: "exact", head: true }).eq("gallery_id", id);
    if (!count) return { ok: false, error: "Add at least one photograph before publishing." };
  }
  const { error } = await supabase.from("portfolio_galleries").update({ ...fields, description: fields.description || null }).eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  done();
  return { ok: true };
}

export async function deleteGallery(formData: FormData): Promise<void> {
  const supabase = await assertAdmin();
  const id = uuid.parse(formData.get("id"));
  if (formData.get("confirm") !== "DELETE") throw new Error("CONFIRMATION_REQUIRED");
  await supabase.from("portfolio_galleries").update({ cover_photo_id: null }).eq("id", id);
  const { error } = await supabase.from("portfolio_galleries").delete().eq("id", id); // photos cascade; files queued
  if (error) throw new Error(friendly(error));
  done();
  redirect("/admin/portfolio");
}

// ---------------------------------------------------------------- uploads

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(ALLOWED_UPLOAD_TYPES, { message: "Only JPEG, PNG, WebP, HEIC and TIFF photographs can be uploaded." }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Each photograph must be under 80 MB."),
});

export type UploadTicket = { name: string; key: string; url: string };

/** Step 1: the browser asks for upload links, then sends each file straight to storage. */
export async function requestUploads(galleryId: string, files: { name: string; type: string; size: number }[]): Promise<{ tickets?: UploadTicket[]; error?: string }> {
  await assertAdmin();
  if (!storageConfig()) return { error: "Photo storage isn't connected yet (Cloudflare R2)." };
  const id = uuid.safeParse(galleryId);
  if (!id.success) return { error: "Unknown gallery." };
  if (files.length === 0 || files.length > 50) return { error: "Upload between 1 and 50 photographs at a time." };
  const tickets: UploadTicket[] = [];
  for (const f of files) {
    const parsed = fileSchema.safeParse(f);
    if (!parsed.success) return { error: `${f.name}: ${parsed.error.issues[0]?.message}` };
    const ext = f.name.includes(".") ? f.name.split(".").pop()! : "jpg";
    const key = newKey(`originals/portfolio/${id.data}`, ext);
    tickets.push({ name: f.name, key, url: await presignUpload("private", key, f.type) });
  }
  return { tickets };
}

const finalizeSchema = z.object({
  galleryId: uuid,
  key: z.string().max(300),
  filename: z.string().min(1).max(255),
  replacePhotoId: uuid.optional(),
});

/** Step 2: once a file is in storage, make the web sizes and add (or replace) the photo. */
export async function finalizeUpload(input: z.infer<typeof finalizeSchema>): Promise<{ ok: boolean; error?: string; photoId?: string }> {
  const supabase = await assertAdmin();
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload." };
  const { galleryId, key, filename, replacePhotoId } = parsed.data;
  // The key must be one this server issued for this gallery.
  if (!new RegExp(`^originals/portfolio/${galleryId}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`).test(key)) {
    return { ok: false, error: "Invalid upload." };
  }
  const { data: gallery } = await supabase.from("portfolio_galleries").select("id, title").eq("id", galleryId).single();
  if (!gallery) return { ok: false, error: "Unknown gallery." };

  let original: Buffer;
  try {
    original = await getObjectBytes("private", key);
  } catch {
    return { ok: false, error: `${filename}: the upload didn't arrive. Try again.` };
  }
  if (original.length > MAX_UPLOAD_BYTES) return { ok: false, error: `${filename} is over 80 MB.` };

  let processed;
  try {
    processed = await processImage(original);
  } catch {
    return { ok: false, error: `${filename} couldn't be read as a photograph.` };
  }

  const photoId = replacePhotoId ?? crypto.randomUUID();
  const stamp = Date.now().toString(36);
  const variants = [];
  for (const v of processed.variants) {
    const vkey = `portfolio/${galleryId}/${photoId}-${stamp}-${v.w}.${v.format === "webp" ? "webp" : "jpg"}`;
    await putObject("public", vkey, v.data, `image/${v.format}`, "public, max-age=31536000, immutable");
    variants.push({ w: v.w, h: v.h, format: v.format, key: vkey, bytes: v.bytes });
  }

  const record = {
    original_key: key,
    variants,
    blur_data_url: processed.blurDataUrl,
    width: processed.width,
    height: processed.height,
    bytes: original.length,
    filename,
  };

  if (replacePhotoId) {
    const { error } = await supabase.from("portfolio_photos").update(record).eq("id", replacePhotoId).eq("gallery_id", galleryId);
    if (error) return { ok: false, error: friendly(error) };
  } else {
    const { data: last } = await supabase.from("portfolio_photos").select("sort").eq("gallery_id", galleryId).order("sort", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("portfolio_photos").insert({
      id: photoId,
      gallery_id: galleryId,
      storage_key: `portfolio/${galleryId}/${photoId}`,
      alt: `Photograph from ${gallery.title}`,
      sort: (last?.sort ?? 0) + 1,
      ...record,
    });
    if (error) return { ok: false, error: friendly(error) };
  }
  done();
  return { ok: true, photoId };
}

// ---------------------------------------------------------------- photos

const photoSchema = z.object({
  id: uuid,
  alt: z.string().trim().min(1, "Describe the photograph for people using screen readers.").max(300),
  featured: z.boolean(),
});

export async function updatePhoto(input: { id: string; alt: string; featured: boolean }): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { error } = await supabase.from("portfolio_photos").update({ alt: parsed.data.alt, featured: parsed.data.featured }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: friendly(error) };
  done();
  return { ok: true };
}

export async function deletePhoto(input: { id: string; galleryId: string }): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const id = uuid.parse(input.id);
  const galleryId = uuid.parse(input.galleryId);
  await supabase.from("portfolio_galleries").update({ cover_photo_id: null }).eq("id", galleryId).eq("cover_photo_id", id);
  const { error } = await supabase.from("portfolio_photos").delete().eq("id", id).eq("gallery_id", galleryId);
  if (error) return { ok: false, error: friendly(error) };
  done();
  return { ok: true };
}

export async function reorderPhotos(input: { galleryId: string; ids: string[] }): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const galleryId = uuid.parse(input.galleryId);
  const ids = z.array(uuid).max(1000).parse(input.ids);
  const { error } = await supabase.rpc("reorder_portfolio_photos", { g_id: galleryId, ordered: ids });
  if (error) return { ok: false, error: friendly(error) };
  done();
  return { ok: true };
}

export async function setCover(input: { galleryId: string; photoId: string }): Promise<ActionResult> {
  const supabase = await assertAdmin();
  const { error } = await supabase
    .from("portfolio_galleries")
    .update({ cover_photo_id: uuid.parse(input.photoId) })
    .eq("id", uuid.parse(input.galleryId));
  if (error) return { ok: false, error: friendly(error) };
  done();
  return { ok: true };
}
