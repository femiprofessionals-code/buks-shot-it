import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking-flow";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Check Your Date",
  description: "Choose a service and package, see open dates and times, and send a booking request.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <section className="wrap flex flex-col gap-12 pb-32 pt-16 md:pt-24">
      <div className="flex max-w-3xl flex-col gap-5">
        <p className="label-rule">Booking</p>
        <h1 className="text-[clamp(2.75rem,6vw,5rem)] leading-[1.02] tracking-[-0.015em]">Check your <em>date</em></h1>
        <p className="text-base leading-relaxed text-fg-soft">
          Choose a package, an open date and a start time, then send your request. Nothing is charged now. I review every
          request, and once it&apos;s approved you&apos;ll receive a secure link to pay the 35% retainer that reserves your date.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading packages…</p>}>
        <BookingFlow turnstileSiteKey={env.turnstileSiteKey} />
      </Suspense>
    </section>
  );
}
