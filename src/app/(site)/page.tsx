import Image from "next/image";
import Link from "next/link";
import { heroPhoto, photos, servicePhotos } from "@/content/images";
import { serviceList } from "@/content/services";
import { BookingSteps } from "@/components/sections";
import { ButtonLink, Placeholder, SectionHeading, TextLink } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <section className="wrap grid items-end gap-12 pb-24 pt-12 md:grid-cols-[5fr_7fr] md:pt-14">
        <div className="order-2 flex flex-col gap-7 pb-6 md:order-1">
          <p className="label">Wedding · Portrait · Event · Product</p>
          <h1 className="text-[clamp(3rem,6vw,5.25rem)] leading-[1.02] tracking-[-0.01em]">Every frame, considered.</h1>
          <p className="max-w-[34ch] text-[19px] leading-relaxed">
            Wedding, portrait, event and product photography for couples, families, professionals and growing brands. I take no
            more than two sessions a day, so yours gets my full attention.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <ButtonLink href="/book">Check your date</ButtonLink>
            <ButtonLink href="/portfolio" variant="secondary">View the portfolio</ButtonLink>
          </div>
        </div>
        <div className="relative order-1 aspect-[4/3] md:order-2">
          <Image src={heroPhoto.src} alt={heroPhoto.alt} fill priority placeholder="blur" sizes="(max-width: 768px) 100vw, 58vw" className="object-cover" />
        </div>
      </section>

      <section className="border-y border-sand bg-white">
        <div className="wrap flex flex-col gap-10 pb-28 pt-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading label="What I photograph" title="Four services, one standard" />
            <TextLink href="/pricing" className="text-[15px]">Compare all prices</TextLink>
          </div>
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {serviceList.map((s) => (
              <li key={s.slug}>
                <Link href={s.path} className="group flex flex-col gap-4 text-charcoal no-underline">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={servicePhotos[s.slug].panel.src}
                      alt={servicePhotos[s.slug].panel.alt}
                      fill
                      placeholder="blur"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                  <h3 className="text-[28px]">{s.name}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-soft">{s.panelLine}</p>
                  <p className="tnum text-[15px] font-semibold">{s.fromLabel}</p>
                  <span className="text-[13px] uppercase tracking-[0.12em] text-bronze-deep group-hover:underline">
                    {s.slug === "events" ? "View options" : s.slug === "portraits" ? "View sessions" : "View packages"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-charcoal text-ivory">
        <div className="wrap grid items-center gap-12 py-28 md:grid-cols-[7fr_5fr] md:gap-16 md:py-32">
          <h2 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.08]">
            Two sessions a day. <span className="text-bronze">All of my attention.</span>
          </h2>
          <p className="text-lg leading-[1.7] text-[#d9d4cb]">
            I keep my calendar small on purpose. Every booking, whether it&apos;s a wedding, a family session or a product shoot,
            gets time to prepare, my full attention on the day, and time to edit properly afterwards. When a date reaches two
            sessions, it closes.
          </p>
        </div>
      </section>

      <section className="wrap flex flex-col gap-10 py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">Recent work</h2>
          <TextLink href="/portfolio" className="text-[15px]">See the full portfolio</TextLink>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
          {[
            { p: photos.whiteDressDesert, c: "col-span-2 md:col-span-7 h-[340px] md:h-[560px]" },
            { p: photos.familyCity, c: "col-span-2 md:col-span-5 h-[340px] md:h-[560px]" },
            { p: photos.styledCake, c: "md:col-span-4 h-[200px] md:h-[380px]" },
            { p: photos.fireworks, c: "md:col-span-4 h-[200px] md:h-[380px]" },
            { p: photos.lakeSunset, c: "col-span-2 md:col-span-4 h-[240px] md:h-[380px]" },
          ].map(({ p, c }) => (
            <div key={p.id} className={`relative ${c}`}>
              <Image src={p.src} alt={p.alt} fill placeholder="blur" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-sand bg-white">
        <div className="wrap flex flex-col gap-12 py-24 md:py-28">
          <SectionHeading label="Four steps" title="How booking works" />
          <BookingSteps />
        </div>
      </section>

      <section className="wrap grid items-center gap-12 py-28 md:grid-cols-[5fr_7fr] md:gap-16">
        <div className="flex aspect-[4/5] items-center justify-center border border-dashed border-bronze bg-linen p-8 text-center text-sm text-stone">
          <Placeholder>a photograph of the photographer behind Buks Shot It</Placeholder>
        </div>
        <div className="flex flex-col gap-6">
          <p className="label">About</p>
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">Behind the camera</h2>
          <p className="max-w-[52ch] text-lg leading-[1.7]">
            <Placeholder>two or three sentences introducing the photographer behind Buks Shot It</Placeholder>
          </p>
          <TextLink href="/about" className="text-[15px]">More about Buks Shot It</TextLink>
        </div>
      </section>

      <section className="bg-linen">
        <div className="wrap flex flex-col items-start gap-5 py-24">
          <h2 className="text-[clamp(2.25rem,4.5vw,3.25rem)]">Ready when you are.</h2>
          <p className="text-lg text-ink-soft">Dates close once they reach two sessions. The request form asks only what the session needs.</p>
          <ButtonLink href="/book" className="mt-2">Check your date</ButtonLink>
        </div>
      </section>
    </>
  );
}
