import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="light-scope flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-[420px] flex-col gap-8">
        <Image src="/brand/buks-wordmark-primary.svg" alt="Buks shot it." width={504} height={77} className="h-6 w-auto self-start" priority />
        <div className="border border-sand bg-white p-8 sm:p-10">{children}</div>
      </div>
    </main>
  );
}
