import Image from "next/image";
import Link from "next/link";
import { mainNav, utilityNav } from "@/content/site";
import { ButtonLink } from "./ui";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { ServicesMenu } from "./services-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <div className="wrap flex h-[72px] items-center justify-between gap-6 lg:h-20">
        <Link href="/" aria-label="Buks Shot It, home" className="shrink-0">
          <Image src="/brand/buks-wordmark-reverse.svg" alt="Buks shot it." width={504} height={77} priority unoptimized className="h-5 w-auto lg:h-6" />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-10 text-[14px] tracking-[0.04em]">
            <li><NavLink href={mainNav[0].href}>{mainNav[0].label}</NavLink></li>
            <li><ServicesMenu /></li>
            {mainNav.slice(1).map((item) => (
              <li key={item.href}><NavLink href={item.href}>{item.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-6 text-[13px]">
          {utilityNav.map((item) => (
            <NavLink key={item.href} href={item.href} className="hidden lg:inline">{item.label}</NavLink>
          ))}
          <span className="hidden sm:block">
            <ButtonLink href="/book" variant="secondary" className="h-10 px-5 text-[11px]">Check your date</ButtonLink>
          </span>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
