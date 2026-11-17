import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Client Gallery",
  description: "Private gallery sign-in for Buks Shot It clients.",
  robots: { index: false, follow: false },
};

export default function GalleryPage() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <div className="flex w-full max-w-[440px] flex-col gap-5 border border-line bg-raised p-10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.5" aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="10" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
        <h1 className="text-5xl">Your <em>gallery</em></h1>
        <p className="text-[15px] leading-relaxed text-fg-soft">
          Your private gallery link and access details were sent by email when your photographs were ready.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="g-email" className="text-sm font-medium">Email address</label>
          <input id="g-email" type="email" autoComplete="email" disabled className="h-12 rounded-[2px] border border-field bg-raised px-3.5" />
        </div>
        <button type="button" disabled className="h-12 rounded-[2px] bg-line-strong text-[13px] font-medium uppercase tracking-[0.12em] text-muted">
          Email me a sign-in link
        </button>
        <p role="status" className="text-sm text-muted">Client galleries open when the site launches.</p>
        <p className="text-sm text-muted">Can&apos;t find your link? <Link href="/contact">Contact me</Link> and I&apos;ll resend it.</p>
      </div>
    </section>
  );
}
