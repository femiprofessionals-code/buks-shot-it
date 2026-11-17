"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadFiles, type Progress } from "./upload-client";
import { primary } from "./ui";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff";

export function Uploader({ galleryId, enabled }: { galleryId: string; enabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Progress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function start(list: FileList | null) {
    if (!list || list.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const err = await uploadFiles(galleryId, Array.from(list), setItems);
    if (err) setError(err);
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  if (!enabled) return <p className="text-sm text-stone">Uploads switch on once photo storage is connected.</p>;
  const done = items.filter((i) => i.state === "done").length;
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); start(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 rounded border border-dashed p-8 text-center ${over ? "border-charcoal bg-linen" : "border-[#cfc6b7] bg-white"}`}
      >
        <p className="text-[15px] text-ink-soft">Drag photographs here, or</p>
        <label className={`${primary} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          Choose photographs
          <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => start(e.target.files)} />
        </label>
        <p className="text-[13px] text-stone">JPEG, PNG, WebP, HEIC or TIFF, up to 80 MB each and 50 at a time. Location and camera details are removed.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      {items.length > 0 ? (
        <div aria-live="polite" className="flex flex-col gap-1.5 text-sm">
          <p className="tnum text-stone">{done} of {items.length} added{busy ? "…" : "."}</p>
          <ul className="flex flex-col gap-1">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-56 truncate">{it.name}</span>
                {it.state === "error" ? (
                  <span className="text-error">{it.error}</span>
                ) : (
                  <>
                    <progress max={100} value={it.state === "uploading" ? it.pct : 100} className="h-1.5 w-40 accent-charcoal" aria-label={`${it.name} upload progress`} />
                    <span className="text-stone">{it.state === "uploading" ? `${it.pct}%` : it.state === "processing" ? "Preparing web sizes…" : "Added"}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
