"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GridPhoto =
  | { kind?: "static"; id: string; src: StaticImageData; alt: string; label: string }
  | { kind: "remote"; id: string; src: string; srcSet: string; largest: string; width: number; height: number; blur: string | null; alt: string; label: string };

/** Photo grid with an accessible full-screen viewer (keyboard, swipe, focus return). */
export function PhotoGrid({ photos }: { photos: GridPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const n = photos.length;

  const close = useCallback(() => {
    setIndex((i) => {
      if (i !== null) triggers.current[i]?.focus();
      return null;
    });
  }, []);
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + n) % n)), [n]);

  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, step]);

  const current = index === null ? null : photos[index];

  return (
    <>
      <ul className="grid grid-cols-1 gap-[3px] md:grid-cols-2">
        {photos.map((p, i) => {
          const w = p.kind === "remote" ? p.width : p.src.width;
          const h = p.kind === "remote" ? p.height : p.src.height;
          const ratio = w / h;
          // Rhythm: a wide photograph across the full width, then two side by side.
          const wide = i % 3 === 0 && ratio >= 1.2;
          const aspect = wide ? Math.max(ratio, 1.6) : Math.min(Math.max(ratio, 0.8), 1.5);
          return (
            <li key={p.id} className={`reveal ${wide ? "md:col-span-2" : ""}`}>
              <button
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                type="button"
                onClick={() => setIndex(i)}
                className="group relative block w-full cursor-zoom-in overflow-hidden bg-raised"
                style={{ aspectRatio: aspect }}
                aria-label={`View larger: ${p.alt}`}
              >
                {p.kind === "remote" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- sizes are pre-generated at upload, so the image optimizer isn't needed
                  <img
                    src={p.src}
                    srcSet={p.srcSet}
                    sizes={wide ? "100vw" : "(max-width: 768px) 100vw, 50vw"}
                    width={p.width}
                    height={p.height}
                    alt={p.alt}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                    style={p.blur ? { backgroundImage: `url(${p.blur})`, backgroundSize: "cover" } : undefined}
                  />
                ) : (
                  <Image src={p.src} alt={p.alt} fill placeholder="blur" sizes={wide ? "100vw" : "(max-width: 768px) 100vw, 50vw"} className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" />
                )}
                {p.label ? (
                  <span className="absolute bottom-0 left-0 p-5 text-[11px] font-medium uppercase tracking-[0.22em] text-ivory opacity-0 transition-opacity duration-500 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)] group-hover:opacity-100 group-focus-visible:opacity-100">
                    {p.label}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photograph viewer"
          className="fixed inset-0 z-50 flex flex-col bg-canvas text-ivory"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <div className="relative min-h-0 flex-1 p-4 md:p-8">
            <div className="relative h-full w-full">
              {current.kind === "remote" ? (
                // eslint-disable-next-line @next/next/no-img-element -- pre-generated sizes
                <img src={current.largest} alt={current.alt} className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <Image src={current.src} alt={current.alt} fill sizes="100vw" className="object-contain" />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 pb-6 pt-3 text-sm md:px-8" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <p>
              <span className="tnum mr-4 text-muted">{(index ?? 0) + 1} / {n}</span>
              {current.alt}
            </p>
            <div className="flex gap-2">
              {["Previous", "Next"].map((label) => (
                <button key={label} type="button" onClick={() => step(label === "Next" ? 1 : -1)} className="h-11 rounded-[2px] border border-line-strong px-4 text-[11px] uppercase tracking-[0.18em] hover:border-ivory">
                  {label}
                </button>
              ))}
              <button ref={closeRef} type="button" onClick={close} className="h-11 rounded-[2px] border border-line-strong px-4 text-[11px] uppercase tracking-[0.18em] hover:border-ivory">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
