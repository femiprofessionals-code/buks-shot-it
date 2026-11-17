import type { Metadata } from "next";
import { ButtonLink, Placeholder } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: "The photographer behind Buks Shot It, and why every session gets full attention.",
  alternates: { canonical: "/about" },
};

const principles = [
  { title: "Two sessions a day, at most.", text: "I limit my calendar so every session gets proper preparation, my full attention on the day, and careful editing afterwards." },
  { title: "Clear from the start.", text: "Prices, what's included and delivery times are published, so there are no surprises." },
  { title: "Every image finished.", text: "You receive edited images, never unprocessed files." },
  { title: "Delivered privately.", text: "Your photographs arrive in a private online gallery, where you can view and download them." },
];

export default function AboutPage() {
  return (
    <>
      <section className="wrap grid items-start gap-14 pb-24 pt-24 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="flex aspect-[4/5] items-center justify-center border border-dashed border-bronze bg-linen p-8 text-center text-sm">
          <Placeholder>a photograph of the photographer</Placeholder>
        </div>
        <div className="flex flex-col gap-6">
          <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">About Buks Shot It</h1>
          <p className="text-lg leading-[1.7]"><Placeholder>who is behind Buks Shot It, two or three sentences in your own words</Placeholder></p>
          <p className="text-lg leading-[1.7]"><Placeholder>how you started, what you love to photograph, what clients can expect working with you</Placeholder></p>
        </div>
      </section>
      <section className="border-y border-sand bg-white">
        <div className="wrap grid gap-12 py-24 md:grid-cols-[4fr_8fr] md:gap-16">
          <h2 className="text-[clamp(2rem,3.4vw,2.75rem)]">How I work</h2>
          <ul className="grid gap-8 sm:grid-cols-2">
            {principles.map((p) => (
              <li key={p.title} className="flex flex-col gap-2 border-t border-charcoal pt-5">
                <h3 className="font-sans text-lg font-semibold">{p.title}</h3>
                <p className="leading-relaxed text-ink-soft">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="wrap flex flex-wrap items-center justify-between gap-6 py-20">
        <p className="text-lg">Instagram <a href={site.instagramUrl} rel="noopener noreferrer" target="_blank">@{site.instagram}</a> · {site.email}</p>
        <ButtonLink href="/book">Check your date</ButtonLink>
      </section>
    </>
  );
}
