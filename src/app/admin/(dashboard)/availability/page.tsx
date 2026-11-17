import type { Metadata } from "next";
import { adminPageClient } from "@/lib/auth";
import { fmtDay } from "@/lib/format";
import { BlockDateForm, UnblockButton } from "./forms";

export const metadata: Metadata = { title: "Blocked dates" };

export default async function Availability() {
  const supabase = await adminPageClient();
  if (!supabase) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const [{ data: blocked }, { data: settings }] = await Promise.all([
    supabase.from("blocked_dates").select("day, reason").gte("day", today).order("day"),
    supabase.from("settings").select("daily_capacity_units, buffer_minutes, full_day_minutes, earliest_start_minutes, latest_end_minutes, slot_minutes, min_notice_hours, hold_hours").maybeSingle(),
  ]);
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Blocked dates</h1>
        <p className="text-ink-soft">Dates you&apos;re not available. Visitors can&apos;t request a blocked date. Existing bookings on it are not changed.</p>
      </div>
      <BlockDateForm min={today} />
      {blocked && blocked.length > 0 ? (
        <ul className="divide-y divide-sand rounded border border-sand bg-white">
          {blocked.map((b) => (
            <li key={b.day} className="flex items-center justify-between gap-4 px-5 py-3">
              <span>{fmtDay(b.day)}{b.reason ? <span className="text-stone"> · {b.reason}</span> : null}</span>
              <UnblockButton day={b.day} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-stone">No upcoming blocked dates.</p>
      )}
      {settings ? (
        <section className="flex flex-col gap-3 border-t border-sand pt-6">
          <h2 className="text-2xl">Booking rules</h2>
          <p className="text-sm text-stone">Editing these arrives with the full dashboard (Deliverable 14).</p>
          <ul className="grid gap-2 text-[15px] sm:grid-cols-2">
            <li>Sessions a day: <strong>{settings.daily_capacity_units}</strong></li>
            <li>Gap after each session: <strong>{settings.buffer_minutes} minutes</strong></li>
            <li>Whole-day sessions: <strong>{settings.full_day_minutes / 60} hours or more</strong></li>
            <li>Booking hours: <strong>{hm(settings.earliest_start_minutes)} to {hm(settings.latest_end_minutes)} ET</strong></li>
            <li>Start times every <strong>{settings.slot_minutes} minutes</strong></li>
            <li>Notice needed: <strong>{settings.min_notice_hours} hours</strong></li>
            <li>Approved dates held for: <strong>{settings.hold_hours} hours</strong></li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
