import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import { serviceList } from "@/content/services";
import { Placeholder } from "./ui";

const linkCls = "text-ash no-underline hover:text-ivory";

export function SiteFooter() {
  return (
    <footer className="bg-charcoal text-ash">
      <div className="wrap grid gap-10 pb-12 pt-20 text-sm leading-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3.5">
          <Image src="/brand/buks-wordmark-reverse.svg" alt="Buks shot it." width={504} height={77} loading="eager" unoptimized className="h-7 w-auto self-start" />
          <p className="text-[11px] uppercase tracking-[0.16em] text-bronze">{site.tagline}</p>
          <p className="max-w-[34ch] leading-relaxed">
            Wedding, portrait, event and product photography
            {site.serviceArea ? ` in ${site.serviceArea}` : <> in <Placeholder>service area</Placeholder></>}.
          </p>
        </div>
        <nav aria-label="Services" className="flex flex-col">
          <span className="font-medium text-ivory">Services</span>
          {serviceList.map((s) => (
            <Link key={s.slug} href={s.path} className={linkCls}>{s.slug === "products" ? "Product photography" : s.name}</Link>
          ))}
          <Link href="/pricing" className={linkCls}>Pricing</Link>
        </nav>
        <nav aria-label="Studio" className="flex flex-col">
          <span className="font-medium text-ivory">Studio</span>
          <Link href="/portfolio" className={linkCls}>Portfolio</Link>
          <Link href="/about" className={linkCls}>About</Link>
          <Link href="/contact" className={linkCls}>Contact</Link>
          <Link href="/gallery" className={linkCls}>Client gallery</Link>
        </nav>
        <div className="flex flex-col">
          <span className="font-medium text-ivory">Contact</span>
          <a href={site.instagramUrl} className={linkCls} rel="noopener noreferrer" target="_blank">Instagram @{site.instagram}</a>
          <span>{site.email}</span>
          <span className="mt-3 font-medium text-ivory">Policies</span>
          <Link href="/booking-terms" className={linkCls}>Booking terms</Link>
          <Link href="/privacy" className={linkCls}>Privacy</Link>
        </div>
      </div>
      <div className="wrap border-t border-graphite pb-7 pt-5 text-xs">
        © {site.copyrightYear} {site.name}. All photographs are the property of {site.name} and may not be used without permission.
      </div>
    </footer>
  );
}
