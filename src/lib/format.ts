/** Formatting in the studio's time zone (Eastern Time). Safe on server and client. */
export const STUDIO_TZ = "America/New_York";

export const fmtDate = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: STUDIO_TZ }).format(new Date(iso));
export const fmtDateLong = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: STUDIO_TZ }).format(new Date(iso));
export const fmtTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: STUDIO_TZ }).format(new Date(iso)).toLowerCase();
export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
/** A plain calendar date (YYYY-MM-DD) shown without any time-zone shift. */
export const fmtDay = (day: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });
/** "2027-06-12T14:30" in the studio's time zone, for date/time inputs. */
export const toLocalInput = (iso: string | Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: STUDIO_TZ })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

export const statusLabel: Record<string, string> = {
  pending: "New request",
  approved: "Approved",
  awaiting_payment: "Awaiting retainer",
  confirmed: "Confirmed",
  rescheduled: "Confirmed (rescheduled)",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Hold expired",
};
