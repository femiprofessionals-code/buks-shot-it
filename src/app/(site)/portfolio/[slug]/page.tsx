import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryView, PortfolioView } from "@/components/portfolio-view";
import { services, type ServiceSlug } from "@/content/services";
import { getPublicPortfolio } from "@/lib/portfolio";

const categories = Object.keys(services) as ServiceSlug[];
const isCategory = (s: string): s is ServiceSlug => (categories as string[]).includes(s);

/** Category pages and gallery pages share /portfolio/[slug]. Gallery slugs can never equal a category (database rule). */
export async function generateStaticParams() {
  const live = await getPublicPortfolio();
  return [...categories, ...(live?.map((g) => g.slug) ?? [])].map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/portfolio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  if (isCategory(slug)) {
    const s = services[slug];
    return { title: `${s.name} Portfolio`, description: `${s.name} photography by Buks Shot It.`, alternates: { canonical: `/portfolio/${slug}` } };
  }
  const g = (await getPublicPortfolio())?.find((x) => x.slug === slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description ?? `${g.title}: ${g.photos.length} photographs by Buks Shot It.`,
    alternates: { canonical: `/portfolio/${slug}` },
    openGraph: { images: [{ url: g.cover.src, width: g.cover.width, height: g.cover.height, alt: g.cover.alt }] },
  };
}

export default async function PortfolioSlugPage(props: PageProps<"/portfolio/[slug]">) {
  const { slug } = await props.params;
  if (isCategory(slug)) return <PortfolioView category={slug} />;
  const view = await GalleryView({ slug });
  if (!view) notFound();
  return view;
}
