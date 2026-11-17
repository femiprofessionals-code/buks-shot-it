import Link from "next/link";
import { serviceList } from "@/content/services";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return (
    <>
    <SiteHeader />
    <main id="main" className="flex-1">
    <section className="wrap flex flex-col gap-6 pb-32 pt-28">
      <h1 className="text-[clamp(3rem,7vw,6rem)] leading-[1] tracking-[-0.015em]">This page <em>isn&apos;t here.</em></h1>
      <p className="text-lg">The link may be old or mistyped.</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[17px]">
        {serviceList.map((s) => <li key={s.slug}><Link href={s.path}>{s.name}</Link></li>)}
        <li><Link href="/">Home</Link></li>
      </ul>
    </section>
    </main>
    <SiteFooter />
    </>
  );
}
