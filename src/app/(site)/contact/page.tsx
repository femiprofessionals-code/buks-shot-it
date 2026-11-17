import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { Placeholder, TextLink } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about weddings, portraits, events, products or licensing. Email or send a message.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <section className="wrap grid items-start gap-16 pb-32 pt-24 md:grid-cols-[5fr_7fr] md:gap-20">
      <div className="flex flex-col gap-6">
        <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[1.04]">Contact</h1>
        <p className="text-lg leading-relaxed">
          For questions before you book, licensing, or anything else. If you already know your date and package, booking is the
          quickest way to check availability.
        </p>
        <TextLink href="/book" className="text-[15px]">Check your date instead</TextLink>
        <dl className="mt-6 border-t border-charcoal text-base">
          <div className="flex justify-between gap-4 border-b border-sand py-4"><dt className="text-stone">Email</dt><dd className="break-all">{site.email}</dd></div>
          <div className="flex justify-between gap-4 border-b border-sand py-4"><dt className="text-stone">Instagram</dt><dd><a href={site.instagramUrl} rel="noopener noreferrer" target="_blank">@{site.instagram}</a></dd></div>
          <div className="flex justify-between gap-4 border-b border-sand py-4"><dt className="text-stone">Based in</dt><dd>{site.serviceArea ?? <Placeholder>service area</Placeholder>}</dd></div>
        </dl>
        <p className="text-sm text-stone">Travel outside the DMV is quoted separately.</p>
      </div>
      <div className="border border-sand bg-white p-6 sm:p-12">
        <Suspense fallback={<p className="text-stone">Loading the form…</p>}>
          <ContactForm />
        </Suspense>
      </div>
    </section>
  );
}
