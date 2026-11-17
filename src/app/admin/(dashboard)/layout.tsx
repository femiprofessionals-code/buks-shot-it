import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

// Sections appear here as each deliverable ships them (D9 bookings, D10 payments, D13 galleries, D14 the rest).
const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/portfolio", label: "Portfolio" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light-scope flex min-h-dvh flex-wrap">
      <aside className="flex w-full flex-col gap-1 bg-charcoal px-4 py-5 text-ivory md:min-h-dvh md:w-60">
        <Image src="/brand/buks-wordmark-reverse.svg" alt="Buks shot it." width={504} height={77} unoptimized className="mx-3 mb-6 h-5 w-auto self-start" />
        <nav aria-label="Admin" className="flex flex-row flex-wrap gap-1 md:flex-col">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex h-10 items-center rounded px-3 text-sm text-[#d9d4cb] no-underline hover:bg-graphite hover:text-ivory">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="flex h-10 items-center rounded px-3 text-sm text-ash no-underline hover:text-ivory md:mt-6">View website</Link>
        </nav>
        <form action={signOut} className="md:mt-auto">
          <button type="submit" className="h-10 px-3 text-left text-sm text-ash hover:text-ivory">Sign out</button>
        </form>
      </aside>
      <main id="main" className="min-w-0 flex-[999_1_640px] px-4 py-8 sm:px-8 lg:px-10">
        {supabaseConfigured ? (
          <Suspense fallback={<p className="text-stone">Loading…</p>}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        ) : (
          <NotConnected />
        )}
      </main>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

function NotConnected() {
  return (
    <div className="max-w-xl border border-sand bg-white p-8">
      <h1 className="mb-3 text-3xl">Admin isn&apos;t connected yet</h1>
      <p className="text-ink-soft">The dashboard needs the Supabase project (sign-in and database). Add its URL and keys to the site&apos;s environment variables to switch it on.</p>
    </div>
  );
}
