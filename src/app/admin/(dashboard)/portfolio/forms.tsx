"use client";

import { useActionState } from "react";
import { createGallery, updateGallery, type ActionResult } from "./actions";
import { categoryLabels, field, primary } from "./ui";

function Message({ state }: { state: ActionResult }) {
  if (state.error) return <p role="alert" className="text-sm text-error">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-success">Saved.</p>;
  return <p role="status" className="sr-only" />;
}

export function CreateGalleryForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createGallery, { ok: false });
  return (
    <form action={action} className="flex flex-col gap-3 rounded border border-sand bg-white p-5">
      <h2 className="text-2xl">New gallery</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-[2] flex-col gap-1.5"><label htmlFor="g-title" className="text-sm font-medium">Title</label><input id="g-title" name="title" required maxLength={120} className={field} placeholder="e.g. Ada & Tom, Spring Wedding" /></div>
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <label htmlFor="g-cat" className="text-sm font-medium">Category</label>
          <select id="g-cat" name="category" className={field}>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <button type="submit" disabled={pending} className={primary}>{pending ? "Creating…" : "Create gallery"}</button>
      </div>
      <Message state={state} />
    </form>
  );
}

export type GalleryFields = { id: string; title: string; slug: string; category: string; description: string | null; featured: boolean; permission_confirmed: boolean; published: boolean };

export function GalleryForm({ gallery }: { gallery: GalleryFields }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateGallery, { ok: false });
  return (
    <form action={action} className="flex flex-col gap-4 rounded border border-sand bg-white p-5">
      <input type="hidden" name="id" value={gallery.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><label htmlFor="e-title" className="text-sm font-medium">Title</label><input id="e-title" name="title" defaultValue={gallery.title} required maxLength={120} className={field} /></div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-cat" className="text-sm font-medium">Category</label>
          <select id="e-cat" name="category" defaultValue={gallery.category} className={field}>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="e-slug" className="text-sm font-medium">Web address</label>
          <div className="flex items-center gap-1 text-[15px] text-stone">/portfolio/<input id="e-slug" name="slug" defaultValue={gallery.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} className={field} aria-describedby="e-slug-hint" /></div>
          <p id="e-slug-hint" className="text-[13px] text-stone">Lowercase letters, numbers and hyphens. Changing it breaks links already shared.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><label htmlFor="e-desc" className="text-sm font-medium">Description <span className="font-normal text-stone">(optional)</span></label><textarea id="e-desc" name="description" defaultValue={gallery.description ?? ""} maxLength={1000} rows={3} className={`${field} h-auto py-2`} /></div>
      </div>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-sm font-medium">Visibility</legend>
        <label className="flex items-start gap-2.5 text-[15px]"><input type="checkbox" name="permission_confirmed" defaultChecked={gallery.permission_confirmed} className="mt-1 size-4 accent-charcoal" />The client has given permission for these photographs to be shown publicly.</label>
        <label className="flex items-start gap-2.5 text-[15px]"><input type="checkbox" name="featured" defaultChecked={gallery.featured} className="mt-1 size-4 accent-charcoal" />Featured (listed first on the Portfolio page)</label>
        <label className="flex items-start gap-2.5 text-[15px]"><input type="checkbox" name="published" defaultChecked={gallery.published} className="mt-1 size-4 accent-charcoal" />Published (visible on the website)</label>
      </fieldset>
      <div className="flex items-center gap-4"><button type="submit" disabled={pending} className={primary}>{pending ? "Saving…" : "Save gallery"}</button><Message state={state} /></div>
    </form>
  );
}
