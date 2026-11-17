import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingEntry } from "@/components/booking-entry";

export const metadata: Metadata = {
  title: "Check Your Date",
  description: "Choose a service and package, see open dates and send a booking request.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <section className="wrap flex flex-col gap-10 pb-32 pt-16">
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-[clamp(2.75rem,6vw,5rem)] leading-[1.02] tracking-[-0.015em]">Check your <em>date</em></h1>
        <p className="text-base leading-relaxed text-fg-soft">
          Choose a service and package. Nothing is charged now. I review every request, and once it&apos;s approved
          you&apos;ll receive a secure link to pay the 35% retainer that reserves your date.
          {/* Deliverable 9: restore "Send a booking request in five short steps." when the full flow is live. */}
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading packages…</p>}>
        <BookingEntry />
      </Suspense>
    </section>
  );
}
