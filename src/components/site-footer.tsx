import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import { serviceList } from "@/content/services";
import { Placeholder } from "./ui";

const linkCls = "text-fg-soft no-underline transition-colors hover:text-bronze";
const headCls = "mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas text-fg-soft">
      <div className="wrap grid gap-12 pb-14 pt-20 text-[15px] leading-8 md:grid-cols-[2fr_1fr_1fr_1fr] md:pt-24">
        <div className="flex flex-col gap-5">
          <Image src="/brand/buks-wordmark-reverse.svg" alt="Buks shot it." width={504} height={77} loading="eager" unoptimized className="h-8 w-auto self-start" />
          <p className="font-display text-2xl italic text-bronze">{site.tagline}</p>
          <p className="max-w-[34ch] leading-relaxed text-muted">
            Wedding, portrait, event and product photography
            {site.serviceArea ? ` in ${site.serviceArea}` : <> in <Placeholder>service area</Placeholder></>}.
          </p>
        </div>
        <nav aria-label="Services" className="flex flex-col">
          <span className={headCls}>Services</span>
          {serviceList.map((s) => (
            <Link key={s.slug} href={s.path} className={linkCls}>{s.slug === "products" ? "Product photography" : s.name}</Link>
          ))}
          <Link href="/pricing" className={linkCls}>Pricing</Link>
        </nav>
        <nav aria-label="Studio" className="flex flex-col">
          <span className={headCls}>Studio</span>
          <Link href="/portfolio" className={linkCls}>Work</Link>
          <Link href="/about" className={linkCls}>About</Link>
          <Link href="/contact" className={linkCls}>Contact</Link>
          <Link href="/gallery" className={linkCls}>Client gallery</Link>
        </nav>
        <div className="flex flex-col">
          <span className={headCls}>Contact</span>
          <a href={site.instagramUrl} className={linkCls} rel="noopener noreferrer" target="_blank">Instagram @{site.instagram}</a>
          <span className="break-all">{site.email}</span>
          <span className={`${headCls} mt-5`}>Policies</span>
          <Link href="/booking-terms" className={linkCls}>Booking terms</Link>
          <Link href="/privacy" className={linkCls}>Privacy</Link>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap pb-8 pt-6 text-xs leading-relaxed text-muted">
          © {site.copyrightYear} {site.name}. All photographs are the property of {site.name} and may not be used without permission.
        </div>
      </div>
    </footer>
  );
}
