import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Complete wedding, portrait, event and product galleries by Buks Shot It.",
  alternates: { canonical: "/portfolio" },
};

export default function PortfolioPage() {
  return <PortfolioView category="all" />;
}
