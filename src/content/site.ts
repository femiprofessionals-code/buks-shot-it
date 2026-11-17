/** Site-wide facts. Only information supplied by the client appears here. */
export const site = {
  name: "Buks Shot It",
  tagline: "Every frame, considered.",
  email: "cjokoro20@gmail.com",
  instagram: "buks.shotit",
  instagramUrl: "https://www.instagram.com/buks.shotit/",
  /** Set when the domain is bought. Used for canonical URLs and the sitemap. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** [Placeholder] confirmed service area wording. */
  serviceArea: null as string | null,
  copyrightYear: 2026,
  retainerPercent: 35,
} as const;

/** Header: Work, Services (menu), About, Contact. */
export const serviceNav = [
  { href: "/wedding-photography", label: "Weddings" },
  { href: "/portrait-photography", label: "Portraits" },
  { href: "/event-photography", label: "Events" },
  { href: "/product-photography", label: "Products" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const mainNav = [
  { href: "/portfolio", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/** Full list for the phone menu. */
export const mobileNav = [
  { href: "/portfolio", label: "Work" },
  ...serviceNav,
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const utilityNav = [{ href: "/gallery", label: "Client gallery" }] as const;

/** Preview builds show a banner and visible placeholders; production builds refuse placeholders. */
export const isProduction = process.env.NEXT_PUBLIC_SITE_STAGE === "production";
