import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioView } from "@/components/portfolio-view";
import { services, type ServiceSlug } from "@/content/services";

const slugs = Object.keys(services) as ServiceSlug[];

export function generateStaticParams() {
  return slugs.map((category) => ({ category }));
}

export async function generateMetadata(props: PageProps<"/portfolio/[category]">): Promise<Metadata> {
  const { category } = await props.params;
  const s = services[category as ServiceSlug];
  if (!s) return {};
  return {
    title: `${s.name} Portfolio`,
    description: `${s.name} photography by Buks Shot It.`,
    alternates: { canonical: `/portfolio/${category}` },
  };
}

export default async function CategoryPage(props: PageProps<"/portfolio/[category]">) {
  const { category } = await props.params;
  if (!slugs.includes(category as ServiceSlug)) notFound();
  return <PortfolioView category={category as ServiceSlug} />;
}
