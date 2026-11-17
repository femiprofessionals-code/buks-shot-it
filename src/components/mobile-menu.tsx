"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mobileNav, site } from "@/content/site";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the menu after navigation (adjusting state during render, per React guidance).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const trigger = openRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openRef}
        type="button"
        className="-mr-2 flex h-11 w-11 items-center justify-center text-ivory lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M3 9h18M3 15h18" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-50 flex flex-col bg-canvas text-ivory"
            >
              <div className="flex h-[72px] items-center justify-between border-b border-line px-4 sm:px-8">
                <Image
                  src="/brand/buks-wordmark-reverse.svg"
                  alt="Buks shot it."
                  width={504}
                  height={77}
                  className="h-5 w-auto"
                />
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center"
                  onClick={() => setOpen(false)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </button>
              </div>
              <nav
                aria-label="Main"
                className="flex-1 overflow-y-auto px-4 pt-6 sm:px-8"
              >
                <ul>
                  {mobileNav.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block py-0.5 font-display text-[clamp(1.75rem,8vw,2.25rem)] leading-[1.2] text-ivory no-underline hover:text-bronze"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex flex-col gap-4 border-t border-line px-4 pb-8 pt-6 sm:px-8">
                <Link
                  href="/book"
                  className="flex h-12 items-center justify-center rounded-[2px] bg-ivory text-[12px] font-medium uppercase tracking-[0.18em] text-canvas no-underline"
                >
                  Check your date
                </Link>
                <div className="flex flex-wrap justify-between gap-3 text-sm text-muted">
                  <Link href="/contact" className="text-muted">
                    Contact
                  </Link>
                  <Link href="/gallery" className="text-muted">
                    Client gallery
                  </Link>
                  <a
                    href={site.instagramUrl}
                    className="text-muted"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    @{site.instagram}
                  </a>
                </div>
                <p className="text-sm text-muted">{site.email}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
