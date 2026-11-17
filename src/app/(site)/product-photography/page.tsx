import type { Metadata } from "next";
import { ServicePage } from "@/components/service-page";
import { services } from "@/content/services";

const service = services.products;

export const metadata: Metadata = {
  title: service.seo.title,
  description: service.seo.description,
  alternates: { canonical: service.path },
};

export default function Page() {
  return <ServicePage service={service} />;
}
