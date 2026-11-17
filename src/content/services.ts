/**
 * Services, packages and add-ons. Prices are exactly as supplied by the client
 * (Deliverable 4, approved). Items still marked "to confirm" in the copy deck are
 * noted in comments and shown as supplied.
 *
 * In Deliverable 9 the packages move to the database (`packages` table); this file
 * then becomes the seed data.
 */
import { site } from "./site";

export type ServiceSlug = "weddings" | "portraits" | "events" | "products";

export type Package = {
  id: string;
  name: string;
  /** Whole-dollar price in cents, or null when priced on request / by quote. */
  priceCents: number | null;
  priceType: "fixed" | "hourly" | "per_image" | "quote" | "on_request";
  bestFor: string;
  facts: { label: string; value: string }[];
  /** Book directly, or start with a quote request. */
  action: "book" | "quote" | "ask";
  /**
   * Session length in minutes for online booking (hourly packages: per hour chosen).
   * Must match `coverage_minutes` in the database seed (supabase/migrations/20261119000000_booking_engine.sql).
   */
  sessionMinutes?: number;
};

export type Service = {
  slug: ServiceSlug;
  path: string;
  name: string;
  navLabel: string;
  title: string;
  intro: string;
  panelLine: string;
  fromLabel: string;
  delivery: string;
  ctaLabel: string;
  packagesHeading: string;
  packagesIntro: string;
  packages: Package[];
  addons: { name: string; price: string }[];
  goodToKnow: { lead: string; text: string }[];
  faqs: { q: string; a: string; placeholder?: boolean }[];
  closing: { heading: string; body: string };
  seo: { title: string; description: string };
};

export function formatPrice(cents: number, opts: { from?: boolean } = {}) {
  const dollars = cents / 100;
  const text = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  });
  return opts.from ? `From ${text}` : text;
}

export function packagePrice(p: Package): string {
  if (p.priceCents === null) return p.priceType === "quote" ? "By quote" : "Pricing on request";
  const base = formatPrice(p.priceCents);
  if (p.priceType === "hourly") return `${base} per hour`;
  if (p.priceType === "per_image") return `${base} per image`;
  if (p.priceType === "quote") return `From ${base}`;
  return base;
}

/** A package fact as a phrase, e.g. "250+ edited images", "1 photographer". */
export function factPhrase(f: { label: string; value: string }): string {
  if (f.label === "Edited images") return `${f.value} edited images`;
  if (f.label === "Photographers") return f.value === "1" ? "1 photographer" : `${f.value} photographers`;
  if (f.label === "Delivery") return `delivery in ${f.value}`;
  return f.value;
}

export function retainerLabel(p: Package): string {
  if (p.priceType !== "fixed" || p.priceCents === null) {
    return p.priceType === "quote" ? "35% of the agreed quote" : "35% of the total";
  }
  return formatPrice(Math.round((p.priceCents * site.retainerPercent) / 100));
}

const payment = {
  lead: "Payment:",
  text: "a 35% non-refundable retainer reserves your date. The balance is due before your final photographs are delivered.",
};
const raw = { lead: "RAW files are not included.", text: "Every image you receive is fully edited." };

export const services: Record<ServiceSlug, Service> = {
  weddings: {
    slug: "weddings",
    path: "/wedding-photography",
    name: "Weddings",
    navLabel: "Weddings",
    title: "Wedding photography",
    intro:
      "Your wedding, photographed as it really happens. I plan the coverage with you, give your day my full attention, and deliver a complete edited gallery within two to four weeks.",
    panelLine: "Calm, complete coverage of your day, from four to eight hours.",
    fromLabel: "From $1,900",
    delivery: "2–4 weeks",
    ctaLabel: "Check your date",
    packagesHeading: "Wedding packages",
    packagesIntro:
      "Every package includes edited images delivered in a private online gallery. A 35% retainer reserves your date.",
    packages: [
      {
        id: "wedding-essential", sessionMinutes: 240,
        name: "Essential",
        priceCents: 190000,
        priceType: "fixed",
        bestFor: "Smaller celebrations and shorter days.",
        facts: [
          { label: "Coverage", value: "4 hours" },
          { label: "Photographers", value: "1" },
          { label: "Edited images", value: "250+" },
        ],
        action: "book",
      },
      {
        id: "wedding-classic", sessionMinutes: 360,
        name: "Classic",
        priceCents: 300000,
        priceType: "fixed",
        bestFor: "A full ceremony and reception, with time planned for portraits.",
        facts: [
          { label: "Coverage", value: "6 hours" },
          { label: "Included", value: "Timeline assistance" },
          { label: "Edited images", value: "400+" },
        ],
        action: "book",
      },
      {
        id: "wedding-signature", sessionMinutes: 480,
        name: "Signature",
        priceCents: 420000,
        priceType: "fixed",
        bestFor: "The whole day, plus an engagement session beforehand.",
        facts: [
          { label: "Coverage", value: "8 hours" },
          { label: "Included", value: "Engagement session" },
          { label: "Edited images", value: "600+" },
        ],
        action: "book",
      },
    ],
    addons: [
      { name: "Additional photographer", price: "+$500–$900" }, // to confirm: what sets the price
      { name: "Additional shooting hour", price: "$250" },
      { name: "Extra edited image", price: "$20" },
      { name: "Travel outside the DMV", price: "Custom quote" },
    ],
    goodToKnow: [
      raw,
      { lead: "Delivery:", text: "your gallery arrives within 2–4 weeks of the wedding." },
      { lead: "Payment:", text: "a 35% non-refundable retainer reserves your date. The remaining balance is due before your final gallery is delivered." },
      { lead: "Travel and extras", text: "may add to the total, and are agreed with you before the date is confirmed." },
    ],
    faqs: [
      { q: "How early should we book?", a: "As early as you can. Dates are confirmed in the order retainers are paid, and I take no more than two sessions on any day." },
      { q: "Can we add more time on the day?", a: "Yes. Additional shooting hours are $250 each." },
      { q: "What does timeline assistance mean?", a: "In the Classic package, I help you plan the timing of the day, so there's room for portraits, family photographs and the moments that matter most to you." },
      { q: "Do you travel?", a: "Yes. Travel outside the DMV is quoted separately, and the quote is agreed before your date is confirmed." },
      { q: "Will we receive the RAW files?", a: "No. RAW files are not included in any package. You receive fully edited images." },
      { q: "When will our photographs be ready?", a: "Within 2–4 weeks of the wedding, once the remaining balance has been paid." },
    ],
    closing: { heading: "Is your date still open?", body: "Choose a package and check availability. It only takes a few details to send a request." },
    seo: {
      title: "Wedding Photography",
      description:
        "Wedding packages from $1,900: 4 to 8 hours of coverage and 250 to 600+ edited images, delivered in 2–4 weeks. Check your date.",
    },
  },

  portraits: {
    slug: "portraits",
    path: "/portrait-photography",
    name: "Portraits",
    navLabel: "Portraits",
    title: "Portrait photography",
    intro:
      "Portraits of people as they are: on their own, together, as a family, or at work. Each session is planned around you, and your edited images arrive within one to two weeks.",
    panelLine: "Individual, couples, family and headshot sessions.",
    fromLabel: "Pricing on request",
    delivery: "1–2 weeks",
    ctaLabel: "Check your date",
    packagesHeading: "Choose your session",
    packagesIntro: "Every session includes edited images delivered in a private online gallery.",
    packages: [
      { id: "portrait-individual", name: "Individual portraits", priceCents: null, priceType: "on_request", bestFor: "For milestones, creative portraits, or simply a good photograph of yourself.", facts: [], action: "ask" },
      { id: "portrait-couples", name: "Couples", priceCents: null, priceType: "on_request", bestFor: "For engagements, anniversaries, or just the two of you.", facts: [], action: "ask" },
      { id: "portrait-family", name: "Family", priceCents: null, priceType: "on_request", bestFor: "For families of any size, at home or on location.", facts: [], action: "ask" },
      { id: "portrait-headshots", name: "Headshots and personal branding", priceCents: null, priceType: "on_request", bestFor: "For professionals who need consistent, current images for work, profiles and press.", facts: [], action: "ask" },
    ],
    addons: [{ name: "Extra edited image", price: "$20" }],
    goodToKnow: [
      { lead: "Delivery:", text: "your edited images arrive within 1–2 weeks of the session." },
      raw,
      payment,
      { lead: "Extra edited images", text: "are $20 each." },
    ],
    faqs: [
      { q: "Where do sessions take place?", a: "Studio, home or outdoor locations, and the area covered.", placeholder: true },
      { q: "How many people can join a family session?", a: "Maximum group size for a family session.", placeholder: true },
      { q: "When will I receive my photographs?", a: "Within 1–2 weeks of your session, once the balance has been paid." },
      { q: "Can I buy more images?", a: "Yes. Extra edited images are $20 each." },
    ],
    closing: { heading: "Book your portrait session", body: "Pick a session type and check an open date." },
    seo: {
      title: "Portrait, Family & Headshot Photography",
      description: "Individual, couples, family and headshot sessions, with edited images delivered within 1–2 weeks.",
    },
  },

  events: {
    slug: "events",
    path: "/event-photography",
    name: "Events",
    navLabel: "Events",
    title: "Event photography",
    intro:
      "Reliable coverage of the moments your event is for, with edited images delivered on a set schedule so you can use them while they still matter.",
    panelLine: "Coverage by the hour or the day, with edited images on a set schedule.",
    fromLabel: "From $100 per hour",
    delivery: "2–3 weeks",
    ctaLabel: "Request event coverage",
    packagesHeading: "Choose your coverage",
    packagesIntro: "Every option includes edited images delivered online. A 35% retainer reserves your date.",
    packages: [
      {
        id: "event-hourly",
        name: "Hourly Coverage",
        priceCents: 10000,
        priceType: "hourly",
        bestFor: "Short events and key moments.",
        facts: [
          { label: "Edited images", value: "35" }, // to confirm: total or per hour
          { label: "Delivery", value: "3–4 business days" },
        ],
        action: "book",
      },
      {
        id: "event-half-day", sessionMinutes: 480,
        name: "Half Day (8 Hours)",
        priceCents: 75000,
        priceType: "fixed",
        bestFor: "Most of an event day.",
        facts: [
          { label: "Included", value: "Edited gallery, highlight images" },
          { label: "Edited images", value: "70" },
          { label: "Delivery", value: "2–3 weeks" }, // to confirm
        ],
        action: "book",
      },
      {
        id: "event-full-day", sessionMinutes: 720,
        name: "Full Day (12 Hours)",
        priceCents: 180000,
        priceType: "fixed",
        bestFor: "Long events, from setup to close.",
        facts: [
          { label: "Included", value: "Event documentation, online delivery" },
          { label: "Edited images", value: "120" },
          { label: "Delivery", value: "2–3 weeks" }, // to confirm
        ],
        action: "book",
      },
    ],
    addons: [
      { name: "Rush delivery (48 hours)", price: "+$150" },
      { name: "Extra edited image", price: "$20" },
      { name: "Travel outside the DMV", price: "Custom quote" },
    ],
    goodToKnow: [
      raw,
      payment,
      { lead: "Tell me about the schedule.", text: "The booking form asks for key times (speeches, awards, performances) so nothing important is missed." },
    ],
    faqs: [
      { q: "Can you photograph a two-hour event?", a: "Yes. Hourly Coverage is $100 per hour." },
      { q: "How fast can I have the photographs?", a: "Hourly Coverage is delivered in 3–4 business days. For anything sooner, rush delivery within 48 hours is +$150." },
      { q: "Can my company use the photographs for marketing?", a: "Usage and licensing terms for business clients.", placeholder: true },
      { q: "Do you travel?", a: "Yes. Travel outside the DMV is quoted separately." },
    ],
    closing: { heading: "Planning an event?", body: "Send the date, the hours and the location. I'll confirm availability and the total." },
    seo: {
      title: "Event Photography",
      description: "Event coverage from $100 per hour, or half and full days. Edited images on a set schedule. Request coverage online.",
    },
  },

  products: {
    slug: "products",
    path: "/product-photography",
    name: "Products",
    navLabel: "Products",
    title: "Product photography",
    intro:
      "Clean, consistent product images for your shop, listings and social channels, at a clear price per image. When you need more than a catalogue, Brand Content adds styling and creative direction.",
    panelLine: "Clean, consistent images that help your products sell.",
    fromLabel: "From $40 per image",
    delivery: "",
    ctaLabel: "Start a product shoot",
    packagesHeading: "Product packages",
    packagesIntro: "Sessions take place on a set date, booked like any other session.",
    packages: [
      { id: "product-simple", sessionMinutes: 120, name: "Simple Product Images", priceCents: 4000, priceType: "per_image", bestFor: "A few products, or adding to an existing catalogue.", facts: [{ label: "Included", value: "Edited images on a white background" }], action: "book" },
      { id: "product-standard", sessionMinutes: 120, name: "Standard Product Package", priceCents: 35000, priceType: "fixed", bestFor: "A small range or a new launch.", facts: [{ label: "Included", value: "Up to 10 edited images" }], action: "book" },
      { id: "product-brand", sessionMinutes: 120, name: "Brand Content Package", priceCents: 80000, priceType: "quote", bestFor: "Campaigns, launches and brand imagery.", facts: [{ label: "Included", value: "Styled product imagery and creative direction" }], action: "quote" },
    ],
    addons: [
      { name: "Rush delivery (48 hours)", price: "+$150" },
      { name: "Extra edited image", price: "$20" },
    ],
    goodToKnow: [
      { lead: "Brand Content", text: "starts with a short brief. I reply with a quote, and once you accept it, the shoot is booked like any other session." },
      raw,
      payment,
    ],
    faqs: [
      { q: "Do I need to send my products to you?", a: "Where product shoots take place, and how products reach the shoot.", placeholder: true },
      { q: "Can you match my existing product photos?", a: "Whether an existing style can be matched, and what is needed first.", placeholder: true },
      { q: "What's the difference between Standard and Brand Content?", a: "Standard gives you up to 10 edited images for $350. Brand Content adds styled scenes and creative direction for imagery that tells your brand's story, and is quoted from $800." },
      { q: "Can I use the images on my website and marketplaces?", a: "Usage and licensing terms for product images.", placeholder: true },
    ],
    closing: { heading: "Ready to photograph your products?", body: "Choose a package and a date, or send a brief for Brand Content." },
    seo: {
      title: "Product Photography",
      description: "Product images from $40 each, a 10-image package for $350, or styled Brand Content by quote.",
    },
  },
};

export const serviceList: Service[] = [services.weddings, services.portraits, services.events, services.products];

export const allAddons = [
  { name: "Extra edited image", price: "$20" },
  { name: "Rush delivery (48 hours)", price: "+$150" },
  { name: "Additional shooting hour", price: "$250" },
  { name: "Additional photographer (weddings)", price: "+$500–$900" },
  { name: "Travel outside the DMV", price: "Custom quote" },
  { name: "RAW files", price: "Not included" },
];

export const deliveryTimes = [
  { service: "Portraits", time: "1–2 weeks" },
  { service: "Events", time: "2–3 weeks (Hourly Coverage: 3–4 business days)" },
  { service: "Weddings", time: "2–4 weeks" },
];

export const bookingSteps = [
  { title: "Request your date", text: "Choose a service and package, pick an open date and tell me about the session." },
  { title: "I review your request", text: "I check the details and reply by email to approve it or talk through options." },
  { title: "Pay the retainer", text: "A 35% non-refundable retainer reserves your date. The balance is due before your photographs are delivered." },
  { title: "Your date is confirmed", text: "You receive a confirmation by email, and the date is held for you." },
];
