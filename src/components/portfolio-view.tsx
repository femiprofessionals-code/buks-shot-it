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
    <nav aria-label="Portfolio categories" className="mt-3 flex flex-wrap gap-2.5">
      {filters.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          aria-current={f.key === current ? "page" : undefined}
          className={`flex h-11 items-center rounded-[2px] border px-4.5 text-sm no-underline ${
            f.key === current ? "border-charcoal bg-charcoal text-ivory" : "border-[#cfc6b7] text-charcoal hover:border-charcoal"
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
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {galleries.map((g) => (
        <li key={g.slug}>
          <Link href={`/portfolio/${g.slug}`} className="group flex flex-col gap-3 text-charcoal no-underline">
            <div className="relative aspect-[4/5] overflow-hidden bg-linen">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-generated sizes */}
              <img src={g.cover.src} srcSet={g.cover.srcSet} sizes="(max-width: 640px) 100vw, 33vw" alt={g.cover.alt} width={g.cover.width} height={g.cover.height} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
            </div>
            <h2 className="text-2xl">{g.title}</h2>
            <p className="text-sm text-stone">{nameOf(g.category)} · {g.photos.length} photographs</p>
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
    id: p.id, src: p.src, alt: p.alt, label: nameOf(p.category),
  }));
  return (
    <>
      <section className="wrap flex flex-col gap-5 pb-10 pt-24">
        <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">{category === "all" ? "Portfolio" : nameOf(category)}</h1>
        <p className="max-w-[56ch] text-[19px] leading-relaxed">{intros[category]}</p>
        <CategoryNav current={category} />
      </section>
      <section className="wrap pb-28">
        {galleries ? (
          galleries.length > 0 ? <GalleryCards galleries={galleries} /> : <p className="text-stone">New galleries are on their way.</p>
        ) : (
          <PhotoGrid photos={temp} />
        )}
      </section>
      <section className="bg-linen">
        <div className="wrap flex flex-wrap items-center justify-between gap-6 py-20">
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">Like what you see?</h2>
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
      <section className="wrap flex flex-col gap-5 pb-10 pt-24">
        <p className="label"><Link href={`/portfolio/${g.category}`} className="text-stone">{nameOf(g.category)}</Link></p>
        <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">{g.title}</h1>
        {g.description ? <p className="max-w-[60ch] text-[19px] leading-relaxed">{g.description}</p> : null}
        <p className="text-sm text-stone">{g.photos.length} photographs</p>
      </section>
      <section className="wrap pb-28"><PhotoGrid photos={photos} /></section>
      <section className="bg-linen">
        <div className="wrap flex flex-wrap items-center justify-between gap-6 py-20">
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">Book a session like this</h2>
          <ButtonLink href="/book">Check your date</ButtonLink>
        </div>
      </section>
    </>
  );
}
