"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { factPhrase, packagePrice, retainerLabel, serviceList, services, type ServiceSlug } from "@/content/services";

/**
 * Step 1 of booking: choose a service and package. Selection lives in the URL so links
 * from service pages arrive preselected and the browser back button works.
 * Dates, details and submission are added by the booking engine (Deliverable 9).
 */
export function BookingEntry() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = (params.get("service") as ServiceSlug) in services ? (params.get("service") as ServiceSlug) : "weddings";
  const service = services[slug];
  const pkgId = params.get("package");
  const pkg = service.packages.find((p) => p.id === pkgId) ?? null;

  const select = (s: ServiceSlug, p?: string) => {
    const q = new URLSearchParams({ service: s });
    if (p) q.set("package", p);
    router.replace(`/book?${q.toString()}`, { scroll: false });
  };

  const optionCls = (on: boolean) =>
    `flex w-full items-center justify-between gap-4 rounded-[2px] border bg-raised px-5 py-4 text-left text-base transition-colors ${
      on ? "border-bronze bg-raised-2 shadow-[inset_0_0_0_1px_var(--color-bronze)]" : "border-line hover:border-field"
    }`;

  return (
    <div className="grid items-start gap-14 lg:grid-cols-[8fr_4fr]">
      <div className="flex flex-col gap-10">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 font-display text-[32px]">What would you like photographed?</legend>
          <div className="grid gap-2.5 sm:grid-cols-4">
            {serviceList.map((s) => (
              <button key={s.slug} type="button" aria-pressed={s.slug === slug} onClick={() => select(s.slug)} className={`${optionCls(s.slug === slug)} justify-center`}>
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-3 text-lg font-semibold">Choose a package</legend>
          {service.packages.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.id === pkg?.id} onClick={() => select(slug, p.id)} className={optionCls(p.id === pkg?.id)}>
              <span className="flex flex-col gap-1">
                <strong className="text-[17px]">{p.name}</strong>
                <span className="text-sm text-muted">{p.facts.map(factPhrase).join(" · ") || p.bestFor}</span>
              </span>
              <span className="flex flex-col items-end gap-1 text-right">
                <span className="tnum font-display text-2xl">{packagePrice(p)}</span>
                {p.priceType !== "on_request" ? <span className="text-[13px] text-muted">Retainer {retainerLabel(p)}</span> : null}
              </span>
            </button>
          ))}
        </fieldset>

        <div className="flex flex-col gap-4 border-t border-line pt-6">
          <p role="status" className="rounded-[2px] border-l-2 border-caution bg-raised-2 px-4 py-3.5 text-[15px] text-caution">
            Online date selection opens soon. For now, send your preferred date and I&apos;ll reply to confirm availability.
          </p>
          <Link
            href={`/contact?topic=${slug === "products" ? "products" : slug}${pkg ? `&session=${encodeURIComponent(`${service.name}: ${pkg.name}`)}` : ""}`}
            className="inline-flex h-12 items-center self-start rounded-[2px] bg-ivory px-7 text-[12px] font-medium uppercase tracking-[0.18em] text-canvas no-underline hover:bg-white"
          >
            Send your date
          </Link>
        </div>
      </div>

      <aside aria-label="Your request" className="border border-line bg-raised p-7 lg:sticky lg:top-6">
        <p className="label mb-5">Your request</p>
        <dl className="flex flex-col gap-3.5 text-[15px]">
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Service</dt><dd>{service.name}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Package</dt><dd>{pkg?.name ?? "Not chosen yet"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Price</dt><dd className="tnum font-display text-[28px]">{pkg ? packagePrice(pkg) : "—"}</dd></div>
          {pkg && pkg.priceType !== "on_request" ? (
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Retainer to reserve</dt><dd className="font-semibold">{retainerLabel(pkg)}</dd></div>
          ) : null}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">The balance is due before your photographs are delivered.</p>
      </aside>
    </div>
  );
}
