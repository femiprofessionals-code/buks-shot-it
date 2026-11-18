import Image from "next/image";
import Link from "next/link";
import { heroPhoto, photos, servicePhotos } from "@/content/images";
import { serviceList } from "@/content/services";
import { ArrowLink, ButtonLink, Placeholder } from "@/components/ui";

/** Home: photographs first. Prices live on the service and pricing pages (decided 18 Nov 2026). */
export default function HomePage() {
  return (
    <>
      {/* Full-screen opening photograph */}
      <section className="relative isolate flex h-[calc(100svh-72px)] max-h-[1100px] min-h-[540px] items-end overflow-hidden lg:h-[calc(100svh-80px)]">
        <div className="hero-parallax absolute inset-0 -z-20 overflow-hidden">
          <Image
            src={heroPhoto.src}
            alt={heroPhoto.alt}
            fill
            priority
            placeholder="blur"
            quality={85}
            sizes="100vw"
            className="hero-zoom object-cover object-[58%_45%]"
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-canvas)_0%,rgb(14_13_12/0.55)_28%,rgb(14_13_12/0)_60%)]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-canvas/60 via-transparent to-transparent md:block" />
        <div className="wrap flex flex-col gap-7 pb-12 md:gap-8 md:pb-24">
          <p className="label-rule hero-in text-fg-soft">Wedding · Portrait · Event · Product</p>
          <h1 className="max-w-[12ch] text-[clamp(3.5rem,9vw,8.5rem)] leading-[0.95] tracking-[-0.02em]">
            <span className="line-mask"><span>Every frame,</span></span>{" "}
            <span className="line-mask"><em>considered.</em></span>
          </h1>
          <div className="hero-in flex flex-wrap items-center gap-x-10 gap-y-5 [animation-delay:240ms]">
            <ButtonLink href="/portfolio" variant="onPhoto">View the work</ButtonLink>
            <ArrowLink href="/book">Check your date</ArrowLink>
          </div>
        </div>
        <div aria-hidden="true" className="absolute bottom-10 right-4 hidden flex-col items-center gap-3 sm:right-8 md:flex lg:right-12">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted [writing-mode:vertical-rl]">Scroll</span>
          <span className="scroll-cue" />
        </div>
      </section>

      {/* Approach */}
      <section className="wrap grid gap-8 py-20 md:grid-cols-[4fr_8fr] md:gap-16 md:py-40">
        <p className="label-rule reveal">The approach</p>
        <div className="reveal flex flex-col gap-10">
          <p className="font-display text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.25] text-ivory">
            Weddings, portraits, events and products, photographed for couples, families, professionals and growing brands.{" "}
            <span className="text-muted">
              I take no more than two sessions a day, so every one gets time to prepare, my full attention on the day, and time to
              edit properly afterwards.
            </span>
          </p>
          <ArrowLink href="/about">About Buks Shot It</ArrowLink>
        </div>
      </section>

      {/* Services: four large photographs */}
      <section aria-labelledby="services-title" className="border-t border-line">
        <div className="wrap flex flex-wrap items-end justify-between gap-6 pb-12 pt-24 md:pt-32">
          <div className="reveal flex flex-col gap-5">
            <p className="label-rule">What I photograph</p>
            <h2 id="services-title" className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02]">
              Four services, <em>one standard</em>
            </h2>
          </div>
          <ArrowLink href="/pricing" className="reveal">Services and pricing</ArrowLink>
        </div>
        <ul className="grid gap-[3px] sm:grid-cols-2">
          {serviceList.map((s, i) => (
            <li key={s.slug}>
              <Link href={s.path} className="reveal-img group relative block aspect-[4/5] overflow-hidden bg-raised text-ivory no-underline sm:aspect-[4/3]">
                <div className="parallax">
                  <Image
                    src={servicePhotos[s.slug].panel.src}
                    alt=""
                    fill
                    placeholder="blur"
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgb(14_13_12/0.88)_0%,rgb(14_13_12/0.35)_30%,rgb(14_13_12/0)_55%)]" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 md:p-10">
                  <div className="flex flex-col gap-3">
                    <span className="text-[12px] font-medium tracking-[0.22em] text-bronze">0{i + 1}</span>
                    <h3 className="text-[clamp(2.25rem,4vw,3.5rem)] leading-none">{s.name}</h3>
                    <p className="max-w-[36ch] text-[15px] leading-relaxed text-fg-soft">{s.panelLine}</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ivory/50 transition-colors duration-300 group-hover:border-ivory group-hover:bg-ivory group-hover:text-canvas md:flex"
                  >
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Selected work */}
      <section className="wrap flex flex-col gap-12 py-28 md:py-36">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="reveal flex flex-col gap-5">
            <p className="label-rule">Selected work</p>
            <h2 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02]">
              Recent <em>work</em>
            </h2>
          </div>
          <ArrowLink href="/portfolio" className="reveal">See the full portfolio</ArrowLink>
        </div>
        <div className="grid grid-cols-2 gap-[3px] md:grid-cols-12">
          {[
            { p: photos.whiteDressDesert, c: "col-span-2 md:col-span-8 aspect-[3/2]", s: "(max-width: 768px) 100vw, 66vw" },
            { p: photos.portraitClose, c: "col-span-2 md:col-span-4 aspect-[4/5] md:aspect-auto", s: "(max-width: 768px) 100vw, 33vw" },
            { p: photos.styledCake, c: "md:col-span-4 aspect-square", s: "(max-width: 768px) 50vw, 33vw" },
            { p: photos.fireworks, c: "md:col-span-4 aspect-square", s: "(max-width: 768px) 50vw, 33vw" },
            { p: photos.familyCity, c: "col-span-2 md:col-span-4 aspect-[4/3] md:aspect-square", s: "(max-width: 768px) 100vw, 33vw" },
          ].map(({ p, c, s }) => (
            <Link key={p.id} href={`/portfolio/${p.category}`} className={`reveal-img group relative block overflow-hidden bg-raised ${c}`}>
              <div className="parallax">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  placeholder="blur"
                  sizes={s}
                  className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="border-t border-line">
        <div className="wrap grid items-center gap-12 py-28 md:grid-cols-[5fr_7fr] md:gap-20 md:py-36">
          <div className="reveal flex aspect-[4/5] items-center justify-center border border-dashed border-bronze/60 bg-raised p-8 text-center text-sm">
            <Placeholder>a photograph of the photographer behind Buks Shot It</Placeholder>
          </div>
          <div className="reveal flex flex-col gap-7">
            <p className="label-rule">About</p>
            <h2 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02]">
              Behind the <em>camera</em>
            </h2>
            <p className="max-w-[52ch] text-lg leading-[1.75] text-fg-soft">
              <Placeholder>two or three sentences introducing the photographer behind Buks Shot It</Placeholder>
            </p>
            <ArrowLink href="/about">More about Buks Shot It</ArrowLink>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="relative isolate overflow-hidden border-t border-line">
        <div className="parallax -z-20">
          <Image src={photos.coupleBench.src} alt="" fill placeholder="blur" sizes="100vw" className="object-cover opacity-30" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas via-canvas/60 to-canvas" />
        <div className="wrap reveal flex flex-col items-center gap-8 py-32 text-center md:py-44">
          <p className="label-rule">Two sessions a day, at most</p>
          <h2 className="text-[clamp(3rem,7vw,6rem)] leading-[1]">
            Ready when <em>you are.</em>
          </h2>
          <p className="max-w-[46ch] text-lg leading-relaxed text-fg-soft">
            Dates close once they reach two sessions. The request form asks only what the session needs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            <ButtonLink href="/book">Check your date</ButtonLink>
            <ArrowLink href="/contact">Ask a question</ArrowLink>
          </div>
        </div>
      </section>
    </>
  );
}
