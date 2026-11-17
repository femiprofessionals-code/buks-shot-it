"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { serviceNav } from "@/content/site";

/** "Services" disclosure menu in the header: opens on click, hover or keyboard; closes on Escape or outside click. */
export function ServicesMenu() {
  return (
    <Suspense
      fallback={
        <Link href="/pricing" className="flex items-center gap-1.5 py-2 text-fg-soft no-underline hover:text-ivory">
          Services
        </Link>
      }
    >
      <ServicesMenuInner />
    </Suspense>
  );
}

function ServicesMenuInner() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Mouse: hover opens, moving away closes, and a click never closes it. Keyboard and touch: a click toggles.
  const lastPointer = useRef<string | null>(null);
  const id = useId();
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const current = serviceNav.some((s) => pathname === s.href);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
        }}
        onClick={() => {
          const mouse = lastPointer.current === "mouse";
          lastPointer.current = null;
          setOpen((o) => (mouse ? true : !o));
        }}
        className={`flex items-center gap-1.5 py-2 transition-colors hover:text-ivory ${current || open ? "text-ivory" : "text-fg-soft"}`}
      >
        Services
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <div id={id} hidden={!open} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-4">
        <ul className="min-w-56 border border-line bg-raised py-3 shadow-2xl shadow-black/50">
          {serviceNav.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={pathname === s.href ? "page" : undefined}
                className={`block px-6 py-2.5 font-display text-[22px] no-underline transition-colors hover:bg-raised-2 hover:text-bronze ${pathname === s.href ? "text-bronze" : "text-ivory"}`}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
