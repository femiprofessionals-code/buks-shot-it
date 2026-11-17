"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Navigation link that marks the current page for screen readers and sighted users. */
export function NavLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const current = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`relative py-2 no-underline transition-colors hover:text-ivory after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-bronze after:transition-transform after:duration-300 ${current ? "text-ivory after:scale-x-100" : "text-fg-soft after:scale-x-0 hover:after:scale-x-100"} ${className}`}
    >
      {children}
    </Link>
  );
}
