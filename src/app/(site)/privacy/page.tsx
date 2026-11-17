import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { Placeholder } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Buks Shot It collects, uses and protects your information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p className="text-sm text-muted">Last updated: <Placeholder>date</Placeholder></p>
      <h2>Who I am</h2>
      <p>Buks Shot It, <Placeholder>legal business name and address</Placeholder>. Contact: {site.email}.</p>
      <h2>What I collect</h2>
      <p>When you send a booking request or a message: your name, email address, phone number, session details and location, and anything you choose to tell me. When you pay: payment is handled by Stripe, and I never see or store your full card details. When you visit the site: basic usage data through Google Analytics, only if you accept analytics cookies.</p>
      <h2>Why I collect it</h2>
      <p>To respond to enquiries, manage bookings, take payments, deliver your photographs, and send messages about your booking.</p>
      <h2>Who I share it with</h2>
      <p>Only the services that run the business: Stripe (payments), Resend (email), Google Calendar (scheduling), Vercel (website hosting), Supabase (database), Cloudflare (image storage and spam protection), Sentry (error reports) and Google Analytics. I do not sell your information.</p>
      <h2>Your photographs</h2>
      <p>Client galleries are private and available only to you through a sign-in link sent to your email. <Placeholder>portfolio use and permission policy</Placeholder></p>
      <h2>How long I keep it</h2>
      <p><Placeholder>retention periods for booking records, galleries and messages</Placeholder></p>
      <h2>Your choices</h2>
      <p>You can ask to see, correct or delete your information by emailing {site.email}. <Placeholder>state-specific rights, confirmed by your legal adviser</Placeholder></p>
    </LegalPage>
  );
}
