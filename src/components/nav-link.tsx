"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const base =
  "relative py-2 no-underline transition-colors hover:text-ivory after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:bg-bronze after:transition-transform after:duration-300";

/**
 * Navigation link that marks the current page for screen readers and sighted users.
 * Reading the address is wrapped in Suspense so pages with private, request-time addresses
 * (such as payment links) can still be prerendered; the plain link shows until then.
 */
export function NavLink(props: { href: string; children: ReactNode; className?: string }) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={`${base} text-fg-soft after:scale-x-0 hover:after:scale-x-100 ${props.className ?? ""}`}>
          {props.children}
        </Link>
      }
    >
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const current = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`${base} ${current ? "text-ivory after:scale-x-100" : "text-fg-soft after:scale-x-0 hover:after:scale-x-100"} ${className}`}
    >
      {children}
    </Link>
  );
}
