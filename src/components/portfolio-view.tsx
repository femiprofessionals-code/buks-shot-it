import Link from "next/link";
import { portfolioPhotos } from "@/content/images";
import { serviceList, type ServiceSlug } from "@/content/services";
import { PhotoGrid } from "./photo-grid";
import { ButtonLink } from "./ui";

const intros: Record<ServiceSlug | "all", string> = {
  all: "Complete sessions, not only highlights. Choose a category, then open any photograph to see it full size.",
  weddings: "Full wedding days, from preparation to the last dance.",
  portraits: "Individuals, couples, families and professionals.",
  events: "Celebrations, conferences and gatherings, covered from start to close.",
  products: "Catalogue images and styled brand content.",
};

export function PortfolioView({ category }: { category: ServiceSlug | "all" }) {
  const list = category === "all" ? portfolioPhotos : portfolioPhotos.filter((p) => p.category === category);
  const nameOf = (slug: ServiceSlug) => serviceList.find((s) => s.slug === slug)?.name ?? slug;
  const filters: { href: string; label: string; key: ServiceSlug | "all" }[] = [
    { href: "/portfolio", label: "All", key: "all" },
    ...serviceList.map((s) => ({ href: `/portfolio/${s.slug}`, label: s.name, key: s.slug })),
  ];
  return (
    <>
      <section className="wrap flex flex-col gap-5 pb-10 pt-24">
        <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">{category === "all" ? "Portfolio" : nameOf(category)}</h1>
        <p className="max-w-[56ch] text-[19px] leading-relaxed">{intros[category]}</p>
        <nav aria-label="Portfolio categories" className="mt-3 flex flex-wrap gap-2.5">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.href}
              aria-current={f.key === category ? "page" : undefined}
              className={`flex h-11 items-center rounded-[2px] border px-4.5 text-sm no-underline ${
                f.key === category ? "border-charcoal bg-charcoal text-ivory" : "border-[#cfc6b7] text-charcoal hover:border-charcoal"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </section>
      <section className="wrap pb-28">
        <PhotoGrid photos={list.map((p) => ({ id: p.id, src: p.src, alt: p.alt, label: nameOf(p.category) }))} />
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
