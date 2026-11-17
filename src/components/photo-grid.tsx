"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GridPhoto = { id: string; src: StaticImageData; alt: string; label: string };

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
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {photos.map((p, i) => (
          <li key={p.id} className="flex flex-col gap-2.5">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              type="button"
              onClick={() => setIndex(i)}
              className="relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden"
              aria-label={`View larger: ${p.alt}`}
            >
              <Image src={p.src} alt={p.alt} fill placeholder="blur" sizes="(max-width: 768px) 50vw, 33vw" className="object-cover transition-transform duration-700 hover:scale-[1.02]" />
            </button>
            <p className="text-sm text-stone">{p.label}</p>
          </li>
        ))}
      </ul>

      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photograph viewer"
          className="fixed inset-0 z-50 flex flex-col bg-[#0e0e0e] text-ivory"
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
              <Image src={current.src} alt={current.alt} fill sizes="100vw" className="object-contain" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 pb-6 pt-3 text-sm md:px-8" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <p>
              <span className="tnum mr-3 text-ash">{(index ?? 0) + 1} / {n}</span>
              {current.alt}
            </p>
            <div className="flex gap-2">
              {["Previous", "Next"].map((label) => (
                <button key={label} type="button" onClick={() => step(label === "Next" ? 1 : -1)} className="h-11 rounded-[2px] border border-[#4a4743] px-4 text-[13px] uppercase tracking-[0.1em] hover:border-ivory">
                  {label}
                </button>
              ))}
              <button ref={closeRef} type="button" onClick={close} className="h-11 rounded-[2px] border border-[#4a4743] px-4 text-[13px] uppercase tracking-[0.1em] hover:border-ivory">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
