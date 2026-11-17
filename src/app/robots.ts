import type { MetadataRoute } from "next";
import { isProduction, site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/gallery", "/admin", "/book/pay"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
