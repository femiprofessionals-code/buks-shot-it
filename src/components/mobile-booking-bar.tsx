"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SHOW_ON = ["/wedding-photography", "/portrait-photography", "/event-photography", "/product-photography", "/pricing", "/portfolio"];

/** Fixed "Check your date" bar on phones, after the first screen, on service, pricing and portfolio pages. */
export function MobileBookingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const enabled = SHOW_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-ivory/95 px-4 pt-3 backdrop-blur transition-transform duration-300 sm:hidden ${visible ? "translate-y-0" : "translate-y-full"}`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
    >
      <Link
        href="/book"
        tabIndex={visible ? 0 : -1}
        className="flex h-12 items-center justify-center rounded-[2px] bg-charcoal text-[13px] font-medium uppercase tracking-[0.12em] text-ivory no-underline"
      >
        Check your date
      </Link>
    </div>
  );
}
