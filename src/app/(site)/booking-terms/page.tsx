import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { Placeholder } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Booking Terms",
  description: "Retainer, balance, delivery and booking terms for Buks Shot It sessions.",
  alternates: { canonical: "/booking-terms" },
};

export default function BookingTermsPage() {
  return (
    <LegalPage title="Booking terms">
      <p className="text-sm text-muted">Last updated: <Placeholder>date</Placeholder></p>
      <p>These terms apply to every session booked with Buks Shot It (&ldquo;I&rdquo;, &ldquo;me&rdquo;). <Placeholder>legal business name and state of registration</Placeholder></p>
      <h2>1. Booking and approval</h2>
      <p>A booking request is not a reservation. I review each request and may approve or decline it. A date is reserved only after your request is approved and the retainer is paid.</p>
      <h2>2. Retainer</h2>
      <p>A retainer of 35% of the package price is required to reserve your date. The retainer is non-refundable.</p>
      <h2>3. Holding period</h2>
      <p>After approval, the date is held for 72 hours for the retainer payment. If the retainer is not paid within that time, the hold ends and the date may be offered to someone else.</p>
      <h2>4. Balance</h2>
      <p>The remaining balance is due before final photographs are delivered. Photographs are not delivered until the balance is paid in full.</p>
      <h2>5. Additional services and travel</h2>
      <p>Additional services and travel may add to the total. Travel outside the DMV is quoted separately. Any additions are agreed before your date is confirmed.</p>
      <h2>6. Deliverables</h2>
      <p>You receive the number of edited images stated in your package. RAW files are not included. Standard delivery times are: portraits 1–2 weeks, events 2–3 weeks, weddings 2–4 weeks, after the session.</p>
      <h2>7. Rescheduling</h2>
      <p><Placeholder>rescheduling policy</Placeholder></p>
      <h2>8. Cancellation</h2>
      <p><Placeholder>cancellation by the client, and by Buks Shot It, including illness or emergency</Placeholder></p>
      <h2>9. Copyright and use of photographs</h2>
      <p><Placeholder>copyright ownership, personal-use rights, commercial licensing, portfolio use</Placeholder></p>
      <h2>10. Limitation of liability</h2>
      <p><Placeholder>to be written by your legal adviser</Placeholder></p>
      <h2>11. Contact</h2>
      <p>Questions about these terms: {site.email}</p>
    </LegalPage>
  );
}
