import Image from "next/image";
import { servicePhotos } from "@/content/images";
import type { Service } from "@/content/services";
import { BookingSteps, ClosingBand, Faq, PackageCards, PhotoStory, bookHref } from "./sections";
import { ArrowLink, ButtonLink, SectionHeading } from "./ui";

/** Shared template for the four service pages. */
export function ServicePage({ service }: { service: Service }) {
  const imgs = servicePhotos[service.slug];
  return (
    <>
      <section className="relative isolate flex h-[78svh] max-h-[960px] min-h-[480px] items-end overflow-hidden">
        <div className="hero-parallax absolute inset-0 -z-20 overflow-hidden">
          <Image src={imgs.hero.src} alt={imgs.hero.alt} fill priority placeholder="blur" quality={85} sizes="100vw" className="hero-zoom object-cover" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-canvas)_0%,rgb(14_13_12/0.55)_30%,rgb(14_13_12/0)_62%)]" />
        <div className="wrap flex flex-col gap-6 pb-14 md:pb-20">
          <p className="label-rule hero-in text-fg-soft">{service.name}</p>
          <h1 className="max-w-[16ch] text-[clamp(3rem,7vw,6.25rem)] leading-[0.98] tracking-[-0.015em]"><span className="line-mask"><span>{service.title}</span></span></h1>
        </div>
      </section>

      <section className="wrap grid gap-10 py-20 md:grid-cols-[4fr_8fr] md:gap-16 md:py-28">
        <p className="label-rule">Overview</p>
        <div className="flex flex-col items-start gap-9">
          <p className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.35] text-ivory">{service.intro}</p>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
            <ButtonLink href={bookHref(service)}>{service.ctaLabel}</ButtonLink>
            <ArrowLink href="#packages">See packages</ArrowLink>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="wrap flex flex-col gap-12 py-24 md:py-32">
          <div className="grid items-end gap-6 md:grid-cols-[5fr_7fr] md:gap-12">
            <h2 className="reveal text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.06]">
              {service.slug === "weddings" ? <>One wedding, <em>start to finish</em></> : <>Recent <em>{service.name.toLowerCase()}</em></>}
            </h2>
            <p className="reveal text-[17px] leading-relaxed text-fg-soft">
              {service.slug === "weddings"
                ? "A single highlight can't show how a photographer covers a whole day. This is one complete wedding, in the order it happened."
                : "A selection from recent sessions."}
            </p>
          </div>
          <PhotoStory photos={imgs.story} />
          <ArrowLink href={`/portfolio/${service.slug}`}>See the full gallery</ArrowLink>
        </div>
      </section>

      <section id="packages" className="scroll-mt-24 border-t border-line">
        <div className="wrap flex flex-col gap-14 py-24 md:py-32">
          <SectionHeading label="Packages" title={service.packagesHeading} intro={service.packagesIntro} />
          <PackageCards service={service} />
        </div>
      </section>

      <section className="border-t border-line bg-raised">
        <div className="wrap grid gap-16 py-24 md:grid-cols-2 md:py-28">
          <div className="flex flex-col gap-7">
            <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">
              Add to any <em>{service.slug === "weddings" ? "wedding package" : service.slug === "events" ? "event" : "session"}</em>
            </h2>
            <dl className="border-t border-line-strong text-base">
              {service.addons.map((a) => (
                <div key={a.name} className="flex justify-between gap-4 border-b border-line py-4">
                  <dt className="text-fg-soft">{a.name}</dt>
                  <dd className="tnum text-right text-ivory">{a.price}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-7">
            <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">
              Good to <em>know</em>
            </h2>
            <ul className="flex flex-col border-t border-line-strong text-base leading-relaxed">
              {service.goodToKnow.map((g) => (
                <li key={g.lead} className="border-b border-line py-4 text-fg-soft">
                  <strong className="font-medium text-ivory">{g.lead}</strong> {g.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="wrap flex flex-col gap-14 py-24 md:py-32">
          <SectionHeading label="Four steps" title={<>How booking <em>works</em></>} />
          <BookingSteps />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="wrap grid gap-12 py-24 md:grid-cols-[4fr_8fr] md:gap-16 md:py-32">
          <h2 className="text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.06]">
            {service.name.replace(/s$/, "")} <em>questions</em>
          </h2>
          <Faq items={service.faqs} />
        </div>
      </section>

      <ClosingBand heading={service.closing.heading} body={service.closing.body} href={bookHref(service)} label={service.ctaLabel} image={imgs.panel} />
    </>
  );
}
