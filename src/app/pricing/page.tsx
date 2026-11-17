import type { Metadata } from "next";
import { allAddons, deliveryTimes, packagePrice, services } from "@/content/services";
import { ClosingBand } from "@/components/sections";
import { Placeholder, TextLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Photography Prices & Packages",
  description: "Every wedding, portrait, event and product package with what's included, add-ons, payment terms and delivery times.",
  alternates: { canonical: "/pricing" },
};

const th = "border-b border-charcoal pb-3 pr-4 text-left text-xs font-medium uppercase tracking-[0.12em] text-stone";
const td = "border-b border-sand py-4 pr-4 align-top";
const price = "tnum font-display text-[22px] font-medium";

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-8 gap-8 md:grid-cols-[3fr_9fr] md:gap-12">
      <div className="flex flex-col gap-2">
        <h2 id={`${id}-h`} className="text-4xl">{title}</h2>
        {note ? <p className="text-sm text-stone">{note}</p> : null}
      </div>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </section>
  );
}

export default function PricingPage() {
  const w = services.weddings;
  const e = services.events;
  const p = services.products;
  return (
    <>
      <section className="wrap flex flex-col gap-6 pb-14 pt-24">
        <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">Services and pricing</h1>
        <p className="max-w-[58ch] text-[19px] leading-relaxed">
          Thoughtfully priced for growing brands, professionals, couples, and families. Every package lists exactly what&apos;s
          included, so you know the cost before you ask.
        </p>
        <nav aria-label="Jump to" className="mt-3 flex flex-wrap gap-2.5 text-sm">
          {[["weddings", "Weddings"], ["portraits", "Portraits"], ["events", "Events"], ["products", "Products"], ["addons", "Add-ons"], ["payment", "Payment"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-[2px] border border-[#cfc6b7] px-4 py-2.5 text-charcoal no-underline hover:border-charcoal">
              {label}
            </a>
          ))}
        </nav>
      </section>

      <div className="wrap flex flex-col gap-24 pb-28">
        <Block id="weddings" title="Weddings" note="Delivery in 2–4 weeks">
          <table className="w-full min-w-[560px] border-collapse text-base">
            <thead><tr><th className={th}>Package</th><th className={th}>Price</th><th className={th}>Coverage</th><th className={th}>Edited images</th><th className={th}>Also included</th></tr></thead>
            <tbody>
              {w.packages.map((pk) => (
                <tr key={pk.id}>
                  <td className={`${td} font-semibold`}>{pk.name}</td>
                  <td className={`${td} ${price}`}>{packagePrice(pk)}</td>
                  <td className={`${td} tnum`}>{pk.facts.find((f) => f.label === "Coverage")?.value}</td>
                  <td className={`${td} tnum`}>{pk.facts.find((f) => f.label === "Edited images")?.value}</td>
                  <td className={td}>{pk.facts.find((f) => f.label === "Included" || f.label === "Photographers")?.label === "Photographers" ? "1 photographer" : pk.facts.find((f) => f.label === "Included")?.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3.5 text-sm text-stone">Additional photographer: +$500–$900. <TextLink href={w.path}>Wedding details</TextLink></p>
        </Block>

        <Block id="portraits" title="Portraits" note="Delivery in 1–2 weeks">
          <div className="flex flex-col gap-2 border border-dashed border-bronze bg-linen p-7">
            <p>Individual, couples, family and headshot sessions.</p>
            <p className="text-sm"><Placeholder>portrait packages and prices</Placeholder></p>
          </div>
        </Block>

        <Block id="events" title="Events">
          <table className="w-full min-w-[560px] border-collapse text-base">
            <thead><tr><th className={th}>Option</th><th className={th}>Price</th><th className={th}>Edited images</th><th className={th}>Delivery</th></tr></thead>
            <tbody>
              {e.packages.map((pk) => (
                <tr key={pk.id}>
                  <td className={`${td} font-semibold`}>{pk.name}</td>
                  <td className={`${td} ${price}`}>{packagePrice(pk)}</td>
                  <td className={`${td} tnum`}>{pk.facts.find((f) => f.label === "Edited images")?.value}</td>
                  <td className={td}>{pk.facts.find((f) => f.label === "Delivery")?.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block id="products" title="Products">
          <table className="w-full min-w-[520px] border-collapse text-base">
            <thead><tr><th className={th}>Package</th><th className={th}>Price</th><th className={th}>Included</th></tr></thead>
            <tbody>
              {p.packages.map((pk) => (
                <tr key={pk.id}>
                  <td className={`${td} font-semibold`}>{pk.name}</td>
                  <td className={`${td} ${price}`}>{packagePrice(pk)}</td>
                  <td className={td}>{pk.facts[0]?.value}{pk.priceType === "quote" ? ", by quote" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block id="addons" title="Add-ons">
          <table className="w-full border-collapse text-base">
            <tbody>
              {allAddons.map((a) => (
                <tr key={a.name}><td className={td}>{a.name}</td><td className={`${td} ${price} text-right`}>{a.price}</td></tr>
              ))}
            </tbody>
          </table>
        </Block>

        <section id="payment" aria-labelledby="payment-h" className="grid scroll-mt-8 gap-14 border border-sand bg-white p-7 md:grid-cols-2 md:p-14">
          <div className="flex flex-col gap-5">
            <h2 id="payment-h" className="text-4xl">How payment works</h2>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-base leading-relaxed">
              <li><strong>Retainer.</strong> A 35% non-refundable retainer reserves your date. For example, the retainer for the Classic wedding package ($3,000) is $1,050.</li>
              <li><strong>Balance.</strong> The remaining balance is due before your final photographs are delivered.</li>
              <li><strong>Extras.</strong> Additional services and travel may add to the total. They are agreed with you in writing before your date is confirmed.</li>
            </ol>
            <p className="text-sm text-stone">Payments are processed securely by Stripe. You&apos;ll receive a receipt by email for every payment.</p>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="text-4xl">Delivery times</h2>
            <table className="w-full border-collapse text-base">
              <tbody>
                {deliveryTimes.map((d) => (
                  <tr key={d.service}><td className={td}>{d.service}</td><td className={`${td} text-right`}>{d.time}</td></tr>
                ))}
                <tr><td className={td}>Products</td><td className={`${td} text-right`}><Placeholder>delivery time</Placeholder></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ClosingBand heading="Found the right package?" body="Choose a package and check an open date." href="/book" label="Check your date" />
    </>
  );
}
