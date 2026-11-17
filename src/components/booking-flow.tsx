"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { loadMonth, loadTimes, requestBooking, type BookingState } from "@/app/(site)/book/actions";
import { factPhrase, formatPrice, packagePrice, serviceList, services, type Package, type ServiceSlug } from "@/content/services";
import { site } from "@/content/site";
import { Turnstile } from "./turnstile";

const TZ = "America/New_York";
const FULL_DAY_MINUTES = 360;

type DayInfo = { day: string; free: number; capacity: number };

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso)).toLowerCase().replace(" ", " ");
const fmtMonth = (m: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date(iso)));
const shiftMonth = (m: string, n: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const studioMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);

function minutesFor(pkg: Package, qty: number | null) {
  return pkg.priceType === "hourly" ? (qty ?? 1) * 60 : (pkg.sessionMinutes ?? 120);
}
function durationLabel(mins: number) {
  const h = mins / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}

const policies = [
  `A ${site.retainerPercent}% non-refundable retainer is required to reserve your date.`,
  "The remaining balance is due before your final photographs are delivered.",
  "RAW files are not included.",
  "Additional services and travel may incur extra charges.",
];

const optionCls = (on: boolean) =>
  `flex w-full items-center justify-between gap-4 rounded-[2px] border bg-raised px-5 py-4 text-left text-base transition-colors ${
    on ? "border-bronze bg-raised-2 shadow-[inset_0_0_0_1px_var(--color-bronze)]" : "border-line hover:border-field"
  }`;
const input =
  "h-12 w-full rounded-[2px] border bg-raised px-3.5 text-base text-ivory focus:border-ivory focus:outline-none focus:ring-1 focus:ring-ivory";
const stepHead = "flex items-baseline gap-4 font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-tight";

function Step({ n, title, id, children }: { n: number; title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-28 flex-col gap-5 border-t border-line pt-8">
      <h2 id={id} className={stepHead}>
        <span aria-hidden="true" className="font-display text-xl italic text-bronze">0{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BookingFlow({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const slug = (params.get("service") as ServiceSlug) in services ? (params.get("service") as ServiceSlug) : "weddings";
  const service = services[slug];
  const pkg = service.packages.find((p) => p.id === params.get("package")) ?? null;
  const bookable = pkg && pkg.action !== "ask";

  const [qty, setQty] = useState<number | null>(null);
  const needsQty = pkg?.priceType === "hourly" || pkg?.priceType === "per_image";
  const qtyOk = !needsQty || (qty !== null && Number.isInteger(qty) && qty >= 1 && qty <= (pkg?.priceType === "hourly" ? 12 : 500));
  const minutes = pkg ? minutesFor(pkg, qty) : 0;
  const unitsNeeded = minutes >= FULL_DAY_MINUTES ? 2 : 1;

  const [month, setMonth] = useState(studioMonth);
  const [days, setDays] = useState<DayInfo[] | null>(null);
  const [live, setLive] = useState(true);
  const [monthError, setMonthError] = useState<string | undefined>();
  const [day, setDay] = useState<string | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [timesError, setTimesError] = useState<string | undefined>();
  const [time, setTime] = useState<string | null>(null);
  const [loadingDays, startDays] = useTransition();
  const [loadingTimes, startTimes] = useTransition();
  const [idem] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : ""));
  const [state, action, sending] = useActionState<BookingState, FormData>(requestBooking, { status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const dateRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const select = (s: ServiceSlug, p?: string) => {
    const q = new URLSearchParams({ service: s });
    if (p) q.set("package", p);
    router.replace(`/book?${q.toString()}`, { scroll: false });
  };

  // Changing the package or quantity resets the time (and the date, if it no longer fits).
  const [lastChoice, setLastChoice] = useState(`${pkg?.id}|${qty}`);
  if (`${pkg?.id}|${qty}` !== lastChoice) {
    setLastChoice(`${pkg?.id}|${qty}`);
    setTime(null);
    setTimes(null);
  }

  useEffect(() => {
    if (!bookable) return;
    startDays(async () => {
      const r = await loadMonth(month);
      setDays(r.days);
      setLive(r.live);
      setMonthError(r.error);
    });
  }, [month, bookable, reloadKey]);

  useEffect(() => {
    if (!pkg || !bookable || !day || !qtyOk) return;
    startTimes(async () => {
      const r = await loadTimes({ day, slug: pkg.id, qty: needsQty ? qty : null });
      setTimes(r.times);
      setLive(r.live);
      setTimesError(r.error);
    });
  }, [day, pkg, bookable, qty, qtyOk, needsQty, reloadKey]);

  // A time taken while the form was open: reload dates and times.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.timeGone) {
      setTime(null);
      setReloadKey((k) => k + 1);
    }
  }

  const reveal = (el: HTMLElement | null) => {
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" }));
  };

  const dayMap = useMemo(() => new Map((days ?? []).map((d) => [d.day, d])), [days]);
  const grid = useMemo(() => {
    const first = new Date(`${month}-01T00:00:00Z`);
    const lead = first.getUTCDay();
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [month]);

  const total = pkg?.priceCents != null && pkg.priceType !== "quote" ? pkg.priceCents * (needsQty ? (qty ?? 0) : 1) : null;
  const retainer = total !== null ? Math.round((total * site.retainerPercent) / 100) : null;
  const err = state.fieldErrors ?? {};
  const v: Partial<NonNullable<BookingState["values"]>> = state.values ?? {};
  const fieldProps = (name: keyof NonNullable<BookingState["fieldErrors"]>) => ({
    "aria-invalid": err[name] ? true : undefined,
    "aria-describedby": err[name] ? `${name}-error` : undefined,
    className: `${input} ${err[name] ? "border-danger" : "border-field"}`,
  });
  const groups = (times ?? []).reduce<Record<string, string[]>>((acc, t) => {
    const h = hourOf(t);
    const g = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
    (acc[g] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="grid items-start gap-14 lg:grid-cols-[8fr_4fr]">
      <div className="flex flex-col gap-12">
        {!live ? (
          <p role="status" className="border-l-2 border-caution bg-raised-2 px-4 py-3.5 text-[15px] text-caution">
            Preview: the dates and times below aren&apos;t live yet, and requests can&apos;t be sent until the booking system is connected.
          </p>
        ) : null}

        <Step n={1} id="step-package" title="Service and package">
          <div className="grid gap-2.5 sm:grid-cols-4" role="group" aria-label="Service">
            {serviceList.map((s) => (
              <button key={s.slug} type="button" aria-pressed={s.slug === slug} onClick={() => select(s.slug)} className={`${optionCls(s.slug === slug)} justify-center`}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2.5" role="group" aria-label={`${service.name} packages`}>
            {service.packages.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === pkg?.id}
                onClick={() => {
                  select(slug, p.id);
                  if (p.action !== "ask") reveal(dateRef.current);
                }}
                className={optionCls(p.id === pkg?.id)}
              >
                <span className="flex flex-col gap-1">
                  <strong className="text-[17px] font-medium">{p.name}</strong>
                  <span className="text-sm text-muted">{p.facts.map(factPhrase).join(" · ") || p.bestFor}</span>
                </span>
                <span className="tnum shrink-0 text-right font-display text-2xl">{packagePrice(p)}</span>
              </button>
            ))}
          </div>
          {pkg?.action === "ask" ? (
            <div className="flex flex-col items-start gap-4 border-l-2 border-bronze bg-raised px-5 py-4">
              <p className="text-fg-soft">Portrait sessions are arranged by message for now. Tell me what you have in mind and your preferred dates.</p>
              <Link href={`/contact?topic=portraits&session=${encodeURIComponent(pkg.name)}`} className="text-ivory underline hover:text-bronze">
                Ask about a {pkg.name.toLowerCase()} session
              </Link>
            </div>
          ) : null}
          {pkg?.priceType === "hourly" ? (
            <div className="flex max-w-xs flex-col gap-2">
              <label htmlFor="b-hours" className="text-sm font-medium">How many hours of coverage?</label>
              <select id="b-hours" value={qty ?? ""} onChange={(e) => setQty(e.target.value ? Number(e.target.value) : null)} className={`${input} border-field`}>
                <option value="">Choose hours</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"} · {formatPrice((pkg.priceCents ?? 0) * h)}</option>
                ))}
              </select>
            </div>
          ) : null}
          {pkg?.priceType === "per_image" ? (
            <div className="flex max-w-xs flex-col gap-2">
              <label htmlFor="b-images" className="text-sm font-medium">How many images?</label>
              <input id="b-images" type="number" inputMode="numeric" min={1} max={500} value={qty ?? ""} onChange={(e) => setQty(e.target.value ? Number(e.target.value) : null)} className={`${input} border-field`} />
              <p className="text-[13px] text-muted">{formatPrice(pkg.priceCents ?? 0)} per edited image, 1 to 500.</p>
            </div>
          ) : null}
        </Step>

        {bookable && qtyOk ? (
          <div ref={dateRef}>
            <Step n={2} id="step-date" title="Date">
              <div className="flex items-center justify-between gap-4">
                <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} disabled={month <= studioMonth()} className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong hover:border-ivory disabled:opacity-30" aria-label="Previous month">←</button>
                <p className="font-display text-2xl" aria-live="polite">{fmtMonth(month)}</p>
                <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= shiftMonth(studioMonth(), 23)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong hover:border-ivory disabled:opacity-30" aria-label="Next month">→</button>
              </div>
              {monthError ? <p role="alert" className="text-danger">{monthError}</p> : null}
              <div aria-busy={loadingDays} className={`transition-opacity ${loadingDays ? "opacity-50" : ""}`}>
                <div aria-hidden="true" className="mb-2 grid grid-cols-7 text-center text-[11px] uppercase tracking-[0.16em] text-muted">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}
                </div>
                <ul className="grid grid-cols-7 gap-1" aria-label={`Dates in ${fmtMonth(month)}`}>
                  {grid.map((d, i) => {
                    if (!d) return <li key={`x${i}`} aria-hidden="true" />;
                    const info = dayMap.get(d);
                    const open = !!info && info.free >= unitsNeeded;
                    const status = !info ? "not available" : info.capacity === 0 ? "unavailable" : open ? (info.free < info.capacity ? "limited availability" : "available") : "fully booked";
                    const chosen = d === day;
                    return (
                      <li key={d}>
                        <button
                          type="button"
                          disabled={!open}
                          aria-pressed={chosen}
                          aria-label={`${fmtDay(d)}, ${status}`}
                          onClick={() => {
                            setDay(d);
                            setTime(null);
                            reveal(timeRef.current);
                          }}
                          className={`tnum relative flex aspect-square w-full sm:aspect-auto sm:h-16 flex-col items-center justify-center rounded-[2px] border text-[15px] transition-colors ${
                            chosen ? "border-bronze bg-bronze text-canvas" : open ? "border-line bg-raised hover:border-ivory" : "border-transparent text-muted/60 line-through decoration-muted/40"
                          }`}
                        >
                          {Number(d.slice(8))}
                          {open && info && info.free < info.capacity && !chosen ? <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-caution" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
                  <span><span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-caution align-middle" />One session already booked</span>
                  <span><span aria-hidden="true" className="mr-1.5 line-through">12</span>Not available</span>
                  <span>{pkg && minutes >= FULL_DAY_MINUTES ? "This package uses the whole day." : `Sessions of ${durationLabel(minutes)}.`}</span>
                </p>
              </div>
            </Step>
          </div>
        ) : null}

        {bookable && qtyOk && day ? (
          <div ref={timeRef}>
            <Step n={3} id="step-time" title="Start time">
              <p className="text-fg-soft">{fmtDay(day)}. Times are Eastern Time. Each session is followed by an hour&apos;s gap before the next.</p>
              {timesError ? <p role="alert" className="text-danger">{timesError}</p> : null}
              <div aria-busy={loadingTimes} className={`flex flex-col gap-5 transition-opacity ${loadingTimes ? "opacity-50" : ""}`}>
                {times && times.length === 0 && !loadingTimes ? <p className="text-caution">No start times are free on this date for this package. Please choose another date.</p> : null}
                {Object.entries(groups).map(([label, list]) => (
                  <div key={label} role="group" aria-label={label} className="flex flex-col gap-2.5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {list.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={t === time}
                          onClick={() => {
                            setTime(t);
                            reveal(detailsRef.current);
                          }}
                          className={`tnum h-11 rounded-[2px] border text-[15px] transition-colors ${t === time ? "border-bronze bg-bronze text-canvas" : "border-line bg-raised hover:border-ivory"}`}
                        >
                          {fmtTime(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Step>
          </div>
        ) : null}

        {bookable && qtyOk && day && time && pkg ? (
          <div ref={detailsRef}>
            <Step n={4} id="step-details" title="Your details">
              <form action={action} noValidate className="grid gap-5 sm:grid-cols-2">
                <input type="hidden" name="package" value={pkg.id} />
                <input type="hidden" name="quantity" value={needsQty && qty ? String(qty) : ""} />
                <input type="hidden" name="starts_at" value={time} />
                <input type="hidden" name="idempotency_key" value={idem} />
                <div aria-hidden="true" className="absolute -left-[9999px]">
                  <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="b-name" className="text-sm font-medium">Your name</label>
                  <input id="b-name" name="full_name" defaultValue={v.full_name} autoComplete="name" required maxLength={200} {...fieldProps("full_name")} />
                  {err.full_name ? <p id="full_name-error" className="text-sm text-danger">{err.full_name}</p> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="b-email" className="text-sm font-medium">Email address</label>
                  <input id="b-email" name="email" defaultValue={v.email} type="email" autoComplete="email" required maxLength={254} {...fieldProps("email")} />
                  {err.email ? <p id="email-error" className="text-sm text-danger">{err.email}</p> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="b-phone" className="text-sm font-medium">Phone <span className="font-normal text-muted">(optional)</span></label>
                  <input id="b-phone" name="phone" defaultValue={v.phone} type="tel" autoComplete="tel" maxLength={40} {...fieldProps("phone")} />
                  {err.phone ? <p id="phone-error" className="text-sm text-danger">{err.phone}</p> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="b-location" className="text-sm font-medium">{slug === "products" ? "Where should the products be photographed?" : "Venue or address"}</label>
                  <input id="b-location" name="location" defaultValue={v.location} required maxLength={500} {...fieldProps("location")} />
                  {err.location ? <p id="location-error" className="text-sm text-danger">{err.location}</p> : null}
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="b-notes" className="text-sm font-medium">
                    {slug === "weddings" ? "Tell me about your day" : slug === "events" ? "About the event, and key times (speeches, awards, performances)" : "About your products and how the images will be used"}{" "}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea id="b-notes" name="notes" defaultValue={v.notes} rows={5} maxLength={3000} {...fieldProps("notes")} className={`${fieldProps("notes").className} h-auto py-3`} />
                  {err.notes ? <p id="notes-error" className="text-sm text-danger">{err.notes}</p> : null}
                </div>
                {service.addons.length > 0 ? (
                  <fieldset className="flex flex-col gap-2.5 sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium">Add-ons you&apos;d like <span className="font-normal text-muted">(optional; confirmed with your total when I review your request)</span></legend>
                    {service.addons.map((a) => (
                      <label key={a.name} className="flex items-center gap-3 text-[15px]">
                        <input type="checkbox" name="addons" value={a.name} defaultChecked={v.addons?.includes(a.name)} className="size-4 accent-bronze" />
                        <span>{a.name} <span className="text-muted">· {a.price}</span></span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                <div className="flex flex-col gap-4 border border-line bg-raised p-6 sm:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-bronze">Booking policies</p>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-fg-soft">
                    {policies.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                  <label className="flex items-start gap-3 text-[15px]">
                    <input type="checkbox" name="terms" defaultChecked={v.terms} required aria-invalid={err.terms ? true : undefined} aria-describedby={err.terms ? "terms-error" : undefined} className="mt-1 size-4 accent-bronze" />
                    <span>I&apos;ve read the booking policies and the <Link href="/booking-terms" target="_blank" className="text-ivory underline hover:text-bronze">booking terms</Link>.</span>
                  </label>
                  {err.terms ? <p id="terms-error" className="text-sm text-danger">{err.terms}</p> : null}
                </div>

                <div className="sm:col-span-2"><Turnstile siteKey={turnstileSiteKey} /></div>

                <div className="flex flex-col gap-3 sm:col-span-2">
                  {state.status === "error" && state.message ? <p role="alert" className="text-danger">{state.message}</p> : null}
                  {state.status === "not_connected" ? (
                    <p role="alert" className="text-caution">
                      Online booking isn&apos;t connected yet, so this request wasn&apos;t sent. Please email {site.email} with your date and package.
                    </p>
                  ) : null}
                  <button type="submit" disabled={sending} className="inline-flex h-12 items-center justify-center self-start rounded-[2px] bg-ivory px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-canvas hover:bg-white disabled:opacity-60">
                    {sending ? "Sending…" : pkg.action === "quote" ? "Send quote request" : "Send booking request"}
                  </button>
                  <p className="text-[13px] text-muted">Nothing is charged now. I review every request and reply by email.</p>
                </div>
              </form>
            </Step>
          </div>
        ) : null}
      </div>

      <aside aria-label="Your request" className="border border-line bg-raised p-7 lg:sticky lg:top-28">
        <p className="label mb-5">Your request</p>
        <dl className="flex flex-col gap-3.5 text-[15px]">
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Service</dt><dd>{service.name}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Package</dt><dd>{pkg?.name ?? "Not chosen yet"}</dd></div>
          {pkg && needsQty ? (
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">{pkg.priceType === "hourly" ? "Hours" : "Images"}</dt><dd className="tnum">{qty ?? "—"}</dd></div>
          ) : null}
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Date</dt><dd>{day ? fmtDay(day) : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Start time</dt><dd className="tnum">{time ? `${fmtTime(time)} ET${bookable && qtyOk ? ` · ${durationLabel(minutes)}` : ""}` : "—"}</dd></div>
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-muted">{pkg?.priceType === "quote" ? "Price" : "Total"}</dt>
            <dd className="tnum font-display text-[28px]">{pkg ? (pkg.priceType === "quote" || pkg.priceType === "on_request" ? packagePrice(pkg) : total ? formatPrice(total) : "—") : "—"}</dd>
          </div>
          {retainer ? (
            <div><dt className="text-xs uppercase tracking-[0.12em] text-muted">Retainer to reserve ({site.retainerPercent}%)</dt><dd className="tnum">{formatPrice(retainer)}</dd></div>
          ) : null}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          {pkg?.priceType === "quote" ? "I'll reply with a quote. The retainer is 35% of the agreed total." : "Add-ons and travel are confirmed when I review your request. The balance is due before your photographs are delivered."}
        </p>
      </aside>
    </div>
  );
}
