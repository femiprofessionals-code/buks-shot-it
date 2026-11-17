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
      className={`no-underline transition-colors hover:text-bronze-deep ${current ? "text-bronze-deep underline underline-offset-[6px]" : "text-charcoal"} ${className}`}
    >
      {children}
    </Link>
  );
}
