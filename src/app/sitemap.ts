import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { serviceList } from "@/content/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/", ...serviceList.map((s) => s.path), "/pricing", "/portfolio",
    ...serviceList.map((s) => `/portfolio/${s.slug}`), "/about", "/contact", "/book", "/booking-terms", "/privacy",
  ];
  return paths.map((p) => ({ url: new URL(p, site.url).toString() }));
}
