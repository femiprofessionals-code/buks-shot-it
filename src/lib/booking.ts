import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/lib/env";
import { services, type Package, type ServiceSlug } from "@/content/services";

/**
 * Booking rules shared by the booking page and its server actions.
 * When Supabase is connected, availability comes from the database (get_availability, get_open_times),
 * which also enforces every rule again when a request is sent. Before then, the page runs in preview
 * mode: it shows what the flow looks like, using the default booking hours, and cannot send requests.
 */
export const TIMEZONE = "America/New_York";

/** Defaults; the database settings table is the source of truth once connected. */
export const PREVIEW_RULES = {
  earliestStartMinutes: 7 * 60,
  latestEndMinutes: 24 * 60,
  slotMinutes: 30,
  minNoticeHours: 24,
  fullDayMinutes: 360,
  dailyUnits: 2,
};

export function publicDb() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
}

export type BookablePackage = { service: ServiceSlug; pkg: Package };

/** Packages that can be booked online (portraits stay enquiries until their prices are supplied). */
export function findBookable(slug: string): BookablePackage | null {
  for (const service of Object.keys(services) as ServiceSlug[]) {
    const pkg = services[service].packages.find((p) => p.id === slug);
    if (pkg && pkg.action !== "ask" && (pkg.sessionMinutes || pkg.priceType === "hourly")) return { service, pkg };
  }
  return null;
}

export function sessionMinutes(pkg: Package, qty: number | null): number {
  if (pkg.priceType === "hourly") return (qty ?? 1) * 60;
  return pkg.sessionMinutes ?? 120;
}

export function validQuantity(pkg: Package, qty: number | null): boolean {
  if (pkg.priceType === "hourly") return qty !== null && Number.isInteger(qty) && qty >= 1 && qty <= 12;
  if (pkg.priceType === "per_image") return qty !== null && Number.isInteger(qty) && qty >= 1 && qty <= 500;
  return true;
}

/** The UTC offset of the studio's time zone on a given day, e.g. "-04:00". */
export function zoneOffset(day: string, minutesIntoDay = 12 * 60): string {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutesIntoDay / 60), minutesIntoDay % 60));
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-04:00"
  const off = name?.replace("GMT", "") || "+00:00";
  return off === "" ? "+00:00" : off;
}

/** A studio-local day and minute as an ISO timestamp with the correct offset. */
export function localToIso(day: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  if (minutes >= 24 * 60) {
    const next = new Date(`${day}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nd = next.toISOString().slice(0, 10);
    return new Date(`${nd}T${hh}:${mm}:00${zoneOffset(nd, 0)}`).toISOString();
  }
  return new Date(`${day}T${hh}:${mm}:00${zoneOffset(day, minutes)}`).toISOString();
}

/** Today's date in the studio's time zone (YYYY-MM-DD). */
export function studioToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

export type DayInfo = { day: string; free: number; capacity: number };

/** Preview-mode availability: every future day is open. */
export function previewMonth(from: string, to: string): DayInfo[] {
  const out: DayInfo[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push({ day: d.toISOString().slice(0, 10), free: PREVIEW_RULES.dailyUnits, capacity: PREVIEW_RULES.dailyUnits });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Preview-mode start times, using the default booking hours and notice. */
export function previewTimes(day: string, pkg: Package, qty: number | null): string[] {
  const r = PREVIEW_RULES;
  const mins = sessionMinutes(pkg, qty);
  const earliest = Date.now() + r.minNoticeHours * 3600_000;
  const out: string[] = [];
  for (let m = r.earliestStartMinutes; m <= r.latestEndMinutes - mins; m += r.slotMinutes) {
    const iso = localToIso(day, m);
    if (new Date(iso).getTime() >= earliest) out.push(iso);
  }
  return out;
}

export const isLive = () => supabaseConfigured;
