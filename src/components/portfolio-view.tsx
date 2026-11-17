import Link from "next/link";
import { portfolioPhotos } from "@/content/images";
import { serviceList, type ServiceSlug } from "@/content/services";
import { getPublicPortfolio, type PublicGallery } from "@/lib/portfolio";
import { PhotoGrid, type GridPhoto } from "./photo-grid";
import { ButtonLink } from "./ui";

const intros: Record<ServiceSlug | "all", string> = {
  all: "Complete sessions, not only highlights. Choose a category, then open any gallery to see it from start to finish.",
  weddings: "Full wedding days, from preparation to the last dance.",
  portraits: "Individuals, couples, families and professionals.",
  events: "Celebrations, conferences and gatherings, covered from start to close.",
  products: "Catalogue images and styled brand content.",
};

const nameOf = (slug: ServiceSlug) => serviceList.find((s) => s.slug === slug)?.name ?? slug;

export function CategoryNav({ current }: { current: ServiceSlug | "all" | null }) {
  const filters: { href: string; label: string; key: ServiceSlug | "all" }[] = [
    { href: "/portfolio", label: "All", key: "all" },
    ...serviceList.map((s) => ({ href: `/portfolio/${s.slug}`, label: s.name, key: s.slug })),
  ];
  return (
    <nav aria-label="Portfolio categories" className="flex flex-wrap gap-x-8 gap-y-3 border-b border-line">
      {filters.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          aria-current={f.key === current ? "page" : undefined}
          className={`-mb-px flex h-12 items-center border-b text-[12px] font-medium uppercase tracking-[0.2em] no-underline transition-colors ${
            f.key === current ? "border-bronze text-ivory" : "border-transparent text-muted hover:text-ivory"
          }`}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

function GalleryCards({ galleries }: { galleries: PublicGallery[] }) {
  return (
    <ul className="grid gap-x-[3px] gap-y-14 sm:grid-cols-2">
      {galleries.map((g) => (
        <li key={g.slug}>
          <Link href={`/portfolio/${g.slug}`} className="reveal group flex flex-col gap-4 text-ivory no-underline">
            <div className="relative aspect-[4/3] overflow-hidden bg-raised">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-generated sizes */}
              <img src={g.cover.src} srcSet={g.cover.srcSet} sizes="(max-width: 640px) 100vw, 50vw" alt={g.cover.alt} width={g.cover.width} height={g.cover.height} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
            </div>
            <div className="flex flex-col gap-1.5 px-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-bronze">{nameOf(g.category)}</p>
              <h2 className="text-[32px] leading-tight group-hover:text-bronze">{g.title}</h2>
              <p className="text-sm text-muted">{g.photos.length} photographs</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function PortfolioView({ category }: { category: ServiceSlug | "all" }) {
  const live = await getPublicPortfolio();
  const galleries = live?.filter((g) => category === "all" || g.category === category) ?? null;
  const temp: GridPhoto[] = (category === "all" ? portfolioPhotos : portfolioPhotos.filter((p) => p.category === category)).map((p) => ({
    id: p.id, src: p.src, alt: p.alt, label: category === "all" ? nameOf(p.category) : "",
  }));
  return (
    <>
      <section className="wrap flex flex-col gap-7 pb-12 pt-20 md:pt-28">
        <p className="label-rule hero-in">{category === "all" ? "Complete galleries" : "Portfolio"}</p>
        <h1 className="hero-in text-[clamp(3.25rem,8vw,7rem)] leading-[0.98] tracking-[-0.015em] [animation-delay:100ms]">
          {category === "all" ? <em>Portfolio</em> : <em>{nameOf(category)}</em>}
        </h1>
        <p className="hero-in max-w-[56ch] text-[19px] leading-relaxed text-fg-soft [animation-delay:200ms]">{intros[category]}</p>
        <div className="mt-6"><CategoryNav current={category} /></div>
      </section>
      <section className="wrap pb-28">
        {galleries ? (
          galleries.length > 0 ? <GalleryCards galleries={galleries} /> : <p className="text-muted">New galleries are on their way.</p>
        ) : (
          <PhotoGrid photos={temp} />
        )}
      </section>
      <section className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-8 py-24">
          <h2 className="text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.04]">Like what you <em>see?</em></h2>
          <ButtonLink href="/book">Check your date</ButtonLink>
        </div>
      </section>
    </>
  );
}

export async function GalleryView({ slug }: { slug: string }) {
  const live = await getPublicPortfolio();
  const g = live?.find((x) => x.slug === slug);
  if (!g) return null;
  const photos: GridPhoto[] = g.photos.map((p) => ({
    kind: "remote", id: p.id, src: p.src, srcSet: p.srcSet, largest: p.largest, width: p.width, height: p.height, blur: p.blur, alt: p.alt, label: "",
  }));
  return (
    <>
      <section className="wrap flex flex-col gap-7 pb-14 pt-20 md:pt-28">
        <p className="label-rule"><Link href={`/portfolio/${g.category}`} className="text-muted no-underline hover:text-bronze">{nameOf(g.category)}</Link></p>
        <h1 className="text-[clamp(3rem,7vw,6rem)] leading-[1] tracking-[-0.015em]">{g.title}</h1>
        {g.description ? <p className="max-w-[60ch] text-[19px] leading-relaxed text-fg-soft">{g.description}</p> : null}
        <p className="text-[12px] uppercase tracking-[0.2em] text-muted">{g.photos.length} photographs</p>
      </section>
      <section className="wrap pb-28"><PhotoGrid photos={photos} /></section>
      <section className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-8 py-24">
          <h2 className="text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.04]">Book a session <em>like this</em></h2>
          <ButtonLink href="/book">Check your date</ButtonLink>
        </div>
      </section>
    </>
  );
}
