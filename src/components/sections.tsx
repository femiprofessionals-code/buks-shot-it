import Image from "next/image";
import type { Photo } from "@/content/images";
import { bookingSteps, packagePrice, retainerLabel, type Package, type Service } from "@/content/services";
import { ButtonLink, Placeholder } from "./ui";

export function bookHref(service: Service, pkg?: Package) {
  const params = new URLSearchParams({ service: service.slug });
  if (pkg) params.set("package", pkg.id);
  return `/book?${params.toString()}`;
}

export function PackageCards({ service }: { service: Service }) {
  const cols = service.packages.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={`grid gap-6 md:grid-cols-2 ${cols}`}>
      {service.packages.map((p, i) => {
        const featured = service.packages.length === 3 && i === 1;
        return (
          <article
            key={p.id}
            className={`flex flex-col gap-5 border bg-white p-8 ${featured ? "border-charcoal" : "border-sand"}`}
            aria-labelledby={`${p.id}-name`}
          >
            <h3 id={`${p.id}-name`} className="text-[28px] leading-tight">{p.name}</h3>
            <p className="tnum font-display text-[40px] font-medium leading-none">
              {p.priceType === "on_request" ? <span className="text-[24px]">Pricing on request</span> : packagePrice(p)}
            </p>
            <p className="min-h-12 text-[15px] text-stone">{p.bestFor}</p>
            {p.facts.length > 0 || p.priceType !== "on_request" ? (
              <dl className="border-t border-charcoal text-[15px]">
                {p.facts.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4 border-b border-sand py-2.5">
                    <dt>{f.label}</dt>
                    <dd className="tnum text-right font-semibold">{f.value}</dd>
                  </div>
                ))}
                {p.priceType !== "on_request" ? (
                  <div className="flex justify-between gap-4 border-b border-sand py-2.5">
                    <dt>Retainer to reserve</dt>
                    <dd className="tnum text-right font-semibold">{retainerLabel(p)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm"><Placeholder>price, session length, edited images, people included</Placeholder></p>
            )}
            <div className="mt-auto pt-2">
              {p.action === "ask" ? (
                <ButtonLink href={`/contact?topic=portraits&session=${encodeURIComponent(p.name)}`} variant="secondary" className="w-full">
                  Ask about this session
                </ButtonLink>
              ) : p.action === "quote" ? (
                <ButtonLink href={bookHref(service, p)} variant="secondary" className="w-full">Request a quote</ButtonLink>
              ) : (
                <ButtonLink href={bookHref(service, p)} variant={featured ? "primary" : "secondary"} className="w-full">
                  {service.ctaLabel}
                </ButtonLink>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function Faq({ items }: { items: Service["faqs"] }) {
  return (
    <div className="border-t border-charcoal">
      {items.map((f, i) => (
        <details key={f.q} className="group border-b border-sand" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold marker:hidden">
            {f.q}
            <span aria-hidden="true" className="text-xl font-normal text-stone transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="max-w-[62ch] pb-5 text-base leading-relaxed text-ink-soft">
            {f.placeholder ? <Placeholder>{f.a}</Placeholder> : f.a}
          </p>
        </details>
      ))}
    </div>
  );
}

export function BookingSteps({ dark = false }: { dark?: boolean }) {
  return (
    <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
      {bookingSteps.map((s, i) => (
        <li key={s.title} className={`flex flex-col gap-3 border-t pt-5 ${dark ? "border-ivory" : "border-charcoal"}`}>
          <span className={`font-display text-4xl ${dark ? "text-bronze" : "text-bronze-deep"}`} aria-hidden="true">{i + 1}</span>
          <h3 className="font-sans text-[19px] font-semibold">{s.title}</h3>
          <p className={`text-[15px] leading-relaxed ${dark ? "text-[#d9d4cb]" : "text-ink-soft"}`}>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A complete-story layout: five photographs in an editorial grid. */
export function PhotoStory({ photos }: { photos: Photo[] }) {
  const spans = ["md:col-span-4", "md:col-span-8", "md:col-span-5", "md:col-span-3", "md:col-span-4"];
  const heights = ["h-[300px] md:h-[440px]", "h-[300px] md:h-[440px]", "h-[260px] md:h-[360px]", "h-[260px] md:h-[360px]", "h-[260px] md:h-[360px]"];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      {photos.slice(0, 5).map((p, i) => (
        <div key={`${p.id}-${i}`} className={`relative ${spans[i]} ${heights[i]}`}>
          <Image src={p.src} alt={p.alt} fill placeholder="blur" sizes="(max-width: 768px) 100vw, 60vw" className="object-cover" />
        </div>
      ))}
    </div>
  );
}

export function ClosingBand({ heading, body, href, label }: { heading: string; body: string; href: string; label: string }) {
  return (
    <section className="bg-charcoal text-ivory">
      <div className="wrap flex flex-col items-start gap-5 py-24">
        <h2 className="text-[clamp(2.25rem,4.5vw,3.5rem)] leading-tight">{heading}</h2>
        <p className="text-lg text-[#d9d4cb]">{body}</p>
        <ButtonLink href={href} variant="accent" className="mt-2">{label}</ButtonLink>
      </div>
    </section>
  );
}
