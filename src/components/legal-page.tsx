import type { ReactNode } from "react";
import { isProduction } from "@/content/site";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="wrap max-w-[860px] pb-32 pt-24">
      {isProduction ? null : (
        <p className="mb-10 border-l-2 border-bronze bg-linen px-4 py-3 text-sm">
          Draft for legal review. Not legal advice. Must be reviewed by a local legal professional before launch.
        </p>
      )}
      <h1 className="mb-10 text-[clamp(2.5rem,5vw,3.5rem)] leading-tight">{title}</h1>
      <div className="flex flex-col gap-6 text-base leading-relaxed [&_h2]:mt-4 [&_h2]:font-sans [&_h2]:text-lg [&_h2]:font-semibold">{children}</div>
    </article>
  );
}
