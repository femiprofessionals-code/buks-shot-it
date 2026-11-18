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
            className={`relative flex flex-col gap-6 border bg-raised p-8 md:p-10 ${featured ? "border-bronze/70" : "border-line"}`}
            aria-labelledby={`${p.id}-name`}
          >
            <h3 id={`${p.id}-name`} className="text-[30px] leading-tight">{p.name}</h3>
            <p className="tnum font-display text-[44px] leading-none text-ivory">
              {p.priceType === "on_request" ? <span className="text-[24px]">Pricing on request</span> : packagePrice(p)}
            </p>
            <p className="min-h-12 text-[15px] leading-relaxed text-muted">{p.bestFor}</p>
            {p.facts.length > 0 || p.priceType !== "on_request" ? (
              <dl className="border-t border-line-strong text-[15px]">
                {p.facts.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4 border-b border-line py-3">
                    <dt className="text-fg-soft">{f.label}</dt>
                    <dd className="tnum text-right text-ivory">{f.value}</dd>
                  </div>
                ))}
                {p.priceType !== "on_request" ? (
                  <div className="flex justify-between gap-4 border-b border-line py-3">
                    <dt className="text-fg-soft">Retainer to reserve</dt>
                    <dd className="tnum text-right text-ivory">{retainerLabel(p)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm"><Placeholder>price, session length, edited images, people included</Placeholder></p>
            )}
            <div className="mt-auto pt-3">
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
    <div className="border-t border-line-strong">
      {items.map((f, i) => (
        <details key={f.q} className="group border-b border-line" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-[22px] leading-snug text-ivory marker:hidden hover:text-bronze">
            {f.q}
            <span aria-hidden="true" className="font-sans text-2xl font-light text-bronze transition-transform duration-300 group-open:rotate-45">+</span>
          </summary>
          <p className="max-w-[62ch] pb-6 text-base leading-relaxed text-fg-soft">
            {f.placeholder ? <Placeholder>{f.a}</Placeholder> : f.a}
          </p>
        </details>
      ))}
    </div>
  );
}

export function BookingSteps() {
  return (
    <ol className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
      {bookingSteps.map((s, i) => (
        <li key={s.title} className="flex flex-col gap-4 border-t border-line-strong pt-6">
          <span className="font-display text-5xl italic text-bronze" aria-hidden="true">0{i + 1}</span>
          <h3 className="font-sans text-[18px] font-medium text-ivory">{s.title}</h3>
          <p className="text-[15px] leading-relaxed text-fg-soft">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A complete-story layout: five photographs in an editorial grid. */
export function PhotoStory({ photos }: { photos: Photo[] }) {
  const spans = ["md:col-span-5", "md:col-span-7", "md:col-span-12", "md:col-span-7", "md:col-span-5"];
  const heights = ["aspect-[4/5] md:aspect-auto md:h-[620px]", "aspect-[3/2] md:aspect-auto md:h-[620px]", "aspect-[3/2] md:aspect-[21/9]", "aspect-[3/2] md:aspect-auto md:h-[540px]", "aspect-[4/5] md:aspect-auto md:h-[540px]"];
  const sizes = ["(max-width: 768px) 100vw, 42vw", "(max-width: 768px) 100vw, 58vw", "100vw", "(max-width: 768px) 100vw, 58vw", "(max-width: 768px) 100vw, 42vw"];
  return (
    <div className="grid grid-cols-1 gap-[3px] md:grid-cols-12">
      {photos.slice(0, 5).map((p, i) => (
        <div key={`${p.id}-${i}`} className={`reveal-img relative overflow-hidden bg-raised ${spans[i]} ${heights[i]}`}>
          <div className="parallax">
            <Image src={p.src} alt={p.alt} fill placeholder="blur" sizes={sizes[i]} className="object-cover" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClosingBand({ heading, body, href, label, image }: { heading: string; body: string; href: string; label: string; image?: Photo }) {
  return (
    <section className="relative isolate overflow-hidden border-t border-line">
      {image ? (
        <div className="parallax -z-20">
          <Image src={image.src} alt="" fill placeholder="blur" sizes="100vw" className="object-cover opacity-25" />
        </div>
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas via-canvas/60 to-canvas" />
      <div className="wrap reveal flex flex-col items-center gap-7 py-32 text-center md:py-40">
        <h2 className="max-w-[18ch] text-[clamp(2.75rem,6vw,5rem)] leading-[1.02]">{heading}</h2>
        <p className="max-w-[50ch] text-lg leading-relaxed text-fg-soft">{body}</p>
        <ButtonLink href={href} className="mt-2">{label}</ButtonLink>
      </div>
    </section>
  );
}
