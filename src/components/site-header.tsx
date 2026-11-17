import Image from "next/image";
import Link from "next/link";
import { mainNav, utilityNav } from "@/content/site";
import { ButtonLink } from "./ui";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

export function SiteHeader() {
  return (
    <header className="border-b border-sand bg-ivory">
      <div className="wrap flex h-[72px] items-center justify-between gap-6 lg:h-[84px]">
        <Link href="/" aria-label="Buks Shot It, home" className="shrink-0">
          <Image src="/brand/buks-wordmark-primary.svg" alt="Buks shot it." width={504} height={77} priority className="h-5 w-auto lg:h-[26px]" />
        </Link>
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex gap-7 text-[15px]">
            {mainNav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-5 text-[13px]">
          {utilityNav.map((item) => (
            <NavLink key={item.href} href={item.href} className="hidden text-stone xl:inline">
              {item.label}
            </NavLink>
          ))}
          <span className="hidden sm:block">
            <ButtonLink href="/book">Check your date</ButtonLink>
          </span>
          <span className="sm:hidden">
            <ButtonLink href="/book" className="h-11 px-4 text-[12px]">Book</ButtonLink>
          </span>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
