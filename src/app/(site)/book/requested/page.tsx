import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowLink } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Request Sent", robots: { index: false, follow: false } };

async function Reference({ searchParams }: { searchParams: PageProps<"/book/requested">["searchParams"] }) {
  const ref = (await searchParams).ref;
  const value = typeof ref === "string" && /^[A-Z0-9]{6,12}$/.test(ref) ? ref : null;
  return value ? (
    <p className="text-lg text-fg-soft">
      Your reference is <strong className="tnum font-medium tracking-[0.12em] text-ivory">{value}</strong>. Keep it handy if you need to get in touch.
    </p>
  ) : null;
}

export default function RequestedPage(props: PageProps<"/book/requested">) {
  return (
    <section className="wrap flex max-w-3xl flex-col gap-8 pb-32 pt-20 md:pt-28">
      <p className="label-rule">Request sent</p>
      <h1 className="text-[clamp(3rem,7vw,6rem)] leading-[1] tracking-[-0.015em]">
        Thank you. <em>It&apos;s with me.</em>
      </h1>
      <Suspense fallback={null}>
        <Reference searchParams={props.searchParams} />
      </Suspense>
      <ol className="flex flex-col gap-5 border-t border-line pt-8">
        {[
          ["I review your request", "I check the details and reply by email to approve it or talk through options. Your date isn't reserved yet."],
          ["You pay the retainer", `If it's approved, you'll receive a secure link to pay the ${site.retainerPercent}% non-refundable retainer. The date is held for you for 72 hours.`],
          ["Your date is confirmed", "Once the retainer is paid, you receive a confirmation by email. The balance is due before your photographs are delivered."],
        ].map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[3rem_1fr] gap-2">
            <span aria-hidden="true" className="font-display text-3xl italic text-bronze">0{i + 1}</span>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-sans text-lg font-medium">{t}</h2>
              <p className="text-fg-soft">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-fg-soft">Questions in the meantime? Email {site.email} or message @{site.instagram} on Instagram.</p>
      <ArrowLink href="/portfolio">Back to the work</ArrowLink>
    </section>
  );
}
