import Image from "next/image";
import { servicePhotos } from "@/content/images";
import type { Service } from "@/content/services";
import { BookingSteps, ClosingBand, Faq, PackageCards, PhotoStory, bookHref } from "./sections";
import { ButtonLink, SectionHeading, TextLink } from "./ui";

/** Shared template for the four service pages (approved in Deliverable 5). */
export function ServicePage({ service }: { service: Service }) {
  const imgs = servicePhotos[service.slug];
  return (
    <>
      <div className="relative h-[46vh] min-h-[320px] bg-charcoal md:h-[620px]">
        <Image src={imgs.hero.src} alt={imgs.hero.alt} fill priority placeholder="blur" sizes="100vw" className="object-cover opacity-95" />
      </div>

      <section className="wrap grid items-end gap-10 py-16 md:grid-cols-2 md:py-20">
        <div className="flex flex-col gap-4">
          <p className="label">{service.name}</p>
          <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">{service.title}</h1>
        </div>
        <div className="flex flex-col items-start gap-6">
          <p className="text-[19px] leading-relaxed">{service.intro}</p>
          <ButtonLink href={bookHref(service)}>{service.ctaLabel}</ButtonLink>
        </div>
      </section>

      <section className="border-y border-sand bg-white">
        <div className="wrap flex flex-col gap-9 py-20 md:py-24">
          <div className="grid items-end gap-6 md:grid-cols-[5fr_7fr] md:gap-12">
            <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] leading-tight">
              {service.slug === "weddings" ? "One wedding, start to finish" : `Recent ${service.name.toLowerCase()}`}
            </h2>
            <p className="text-[17px] leading-relaxed text-ink-soft">
              {service.slug === "weddings"
                ? "A single highlight can't show how a photographer covers a whole day. This is one complete wedding, in the order it happened."
                : "A selection from recent sessions."}
            </p>
          </div>
          <PhotoStory photos={imgs.story} />
          <p className="text-sm text-stone">
            <TextLink href={`/portfolio/${service.slug}`}>See the full gallery</TextLink>
          </p>
        </div>
      </section>

      <section id="packages" className="wrap flex scroll-mt-8 flex-col gap-10 py-24 md:py-28">
        <SectionHeading label="Packages" title={service.packagesHeading} intro={service.packagesIntro} />
        <PackageCards service={service} />
      </section>

      <section className="border-y border-sand bg-white">
        <div className="wrap grid gap-16 py-20 md:grid-cols-2 md:py-24">
          <div className="flex flex-col gap-5">
            <h2 className="text-4xl">Add to any {service.slug === "weddings" ? "wedding package" : service.slug === "events" ? "event" : "session"}</h2>
            <dl className="border-t border-charcoal text-base">
              {service.addons.map((a) => (
                <div key={a.name} className="flex justify-between gap-4 border-b border-sand py-3">
                  <dt>{a.name}</dt>
                  <dd className="tnum font-semibold">{a.price}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="text-4xl">Good to know</h2>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-base leading-relaxed">
              {service.goodToKnow.map((g) => (
                <li key={g.lead}>
                  <strong>{g.lead}</strong> {g.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap flex flex-col gap-12 py-24">
        <SectionHeading label="Four steps" title="How booking works" />
        <BookingSteps />
      </section>

      <section className="border-t border-sand">
        <div className="wrap grid gap-12 py-24 md:grid-cols-[4fr_8fr] md:gap-16">
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] leading-tight">{service.name.replace(/s$/, "")} questions</h2>
          <Faq items={service.faqs} />
        </div>
      </section>

      <ClosingBand heading={service.closing.heading} body={service.closing.body} href={bookHref(service)} label={service.ctaLabel} />
    </>
  );
}
