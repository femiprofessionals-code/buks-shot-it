"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePhoto, reorderPhotos, setCover, updatePhoto } from "./actions";
import { uploadFiles } from "./upload-client";
import { field, secondary } from "./ui";

export type AdminPhoto = { id: string; alt: string; featured: boolean; filename: string | null; width: number; height: number; thumb: string | null };

export function PhotoManager({ galleryId, photos, coverId, storage }: { galleryId: string; photos: AdminPhoto[]; coverId: string | null; storage: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState(photos);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastPhotos, setLastPhotos] = useState(photos);
  if (photos !== lastPhotos) { setLastPhotos(photos); setOrder(photos); }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const r = await fn();
      setMessage(r.ok ? { text: success } : { text: r.error ?? "Something went wrong.", error: true });
      router.refresh();
    });
  }

  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    run(() => reorderPhotos({ galleryId, ids: next.map((p) => p.id) }), `Moved ${d < 0 ? "up" : "down"}.`);
  }

  if (order.length === 0) return <p className="text-stone">No photographs yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-stone">The first photograph is the cover unless you choose another. &ldquo;Featured&rdquo; marks photographs for the home and service-page highlights; those sections switch over from the current preview images in a later deliverable.</p>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${message?.error ? "text-error" : "text-success"}`}>{pending ? "Saving…" : message?.text}</p>
      <ol className="flex flex-col gap-3">
        {order.map((p, i) => (
          <PhotoRow key={p.id} photo={p} index={i} total={order.length} isCover={p.id === coverId} storage={storage} galleryId={galleryId} disabled={pending}
            onMove={(d) => move(i, d)}
            onSave={(alt, featured) => run(() => updatePhoto({ id: p.id, alt, featured }), "Photograph saved.")}
            onCover={() => run(() => setCover({ galleryId, photoId: p.id }), "Cover photograph set.")}
            onDelete={() => { if (confirm(`Delete ${p.filename ?? "this photograph"}? This can't be undone.`)) run(() => deletePhoto({ id: p.id, galleryId }), "Photograph deleted."); }}
            onReplaced={(err) => { setMessage(err ? { text: err, error: true } : { text: "Photograph replaced." }); router.refresh(); }}
          />
        ))}
      </ol>
    </div>
  );
}

function PhotoRow(props: {
  photo: AdminPhoto; index: number; total: number; isCover: boolean; storage: boolean; galleryId: string; disabled: boolean;
  onMove: (d: number) => void; onSave: (alt: string, featured: boolean) => void; onCover: () => void; onDelete: () => void; onReplaced: (err: string | null) => void;
}) {
  const { photo: p, index: i, total } = props;
  const [alt, setAlt] = useState(p.alt);
  const [featured, setFeatured] = useState(p.featured);
  const [replacing, setReplacing] = useState(false);
  const dirty = alt !== p.alt || featured !== p.featured;
  const altId = `alt-${p.id}`;

  async function replace(files: FileList | null) {
    if (!files?.[0]) return;
    setReplacing(true);
    let err: string | null = null;
    const startErr = await uploadFiles(props.galleryId, [files[0]], (prog) => { if (prog[0]?.state === "error") err = prog[0].error ?? "Replace failed."; }, p.id);
    setReplacing(false);
    props.onReplaced(startErr ?? err);
  }

  return (
    <li className="flex flex-wrap gap-4 rounded border border-sand bg-white p-3">
      <div className="relative h-32 w-26 shrink-0 overflow-hidden bg-linen">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from storage */}
        {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" /> : null}
        {props.isCover ? <span className="absolute left-1 top-1 rounded-sm bg-charcoal px-1.5 py-0.5 text-[11px] text-ivory">Cover</span> : null}
      </div>
      <div className="flex min-w-60 flex-1 flex-col gap-2">
        <p className="tnum text-[13px] text-stone">{i + 1}. {p.filename ?? "Photograph"} · {p.width}×{p.height}</p>
        <label htmlFor={altId} className="text-sm font-medium">Description for screen readers (alt text)</label>
        <input id={altId} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} className={field} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="size-4 accent-charcoal" />Featured</label>
          <button type="button" className={secondary} disabled={!dirty || props.disabled} onClick={() => props.onSave(alt, featured)}>Save</button>
          <button type="button" className={secondary} disabled={i === 0 || props.disabled} onClick={() => props.onMove(-1)} aria-label={`Move photograph ${i + 1} up`}>↑</button>
          <button type="button" className={secondary} disabled={i === total - 1 || props.disabled} onClick={() => props.onMove(1)} aria-label={`Move photograph ${i + 1} down`}>↓</button>
          <button type="button" className={secondary} disabled={props.isCover || props.disabled} onClick={props.onCover}>Make cover</button>
          {props.storage ? (
            <label className={`${secondary} cursor-pointer ${replacing ? "pointer-events-none opacity-50" : ""}`}>
              {replacing ? "Replacing…" : "Replace"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff" className="sr-only" onChange={(e) => replace(e.target.files)} />
            </label>
          ) : null}
          <button type="button" className={`${secondary} text-error`} disabled={props.disabled} onClick={props.onDelete}>Delete</button>
        </div>
      </div>
    </li>
  );
}
