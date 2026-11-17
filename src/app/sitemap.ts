import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { serviceList } from "@/content/services";
import { getPublicPortfolio } from "@/lib/portfolio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const galleries = (await getPublicPortfolio()) ?? [];
  const paths = [
    "/", ...serviceList.map((s) => s.path), "/pricing", "/portfolio",
    ...serviceList.map((s) => `/portfolio/${s.slug}`), ...galleries.map((g) => `/portfolio/${g.slug}`),
    "/about", "/contact", "/book", "/booking-terms", "/privacy",
  ];
  return paths.map((p) => ({ url: new URL(p, site.url).toString() }));
}
