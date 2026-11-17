"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  findBookable,
  isLive,
  previewMonth,
  previewTimes,
  publicDb,
  studioToday,
  validQuantity,
  type DayInfo,
} from "@/lib/booking";
import { verifyTurnstile } from "@/lib/turnstile";
import { services } from "@/content/services";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function addDays(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Free capacity for each day of a month (no personal data). */
export async function loadMonth(month: string): Promise<{ days: DayInfo[]; live: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { days: [], live: isLive(), error: "Invalid month." };
  const today = studioToday();
  const first = `${month}-01`;
  const last = addDays(addDays(first, 31).slice(0, 7) + "-01", -1);
  const from = first < today ? today : first;
  if (from > last) return { days: [], live: isLive() };
  if (!isLive()) return { days: previewMonth(from, last), live: false };
  const { data, error } = await publicDb().rpc("get_availability", { from_day: from, to_day: last });
  if (error || !data) return { days: [], live: true, error: "Availability couldn't load. Please try again." };
  return {
    live: true,
    days: (data as { day: string; units_used: number; capacity: number }[]).map((d) => ({
      day: d.day,
      free: Math.max(0, d.capacity - d.units_used),
      capacity: d.capacity,
    })),
  };
}

/** Start times that can be requested for a package on a day (ISO timestamps). */
export async function loadTimes(input: { day: string; slug: string; qty: number | null }): Promise<{ times: string[]; live: boolean; error?: string }> {
  const parsed = z.object({ day, slug: z.string().max(60), qty: z.number().int().positive().max(500).nullable() }).safeParse(input);
  if (!parsed.success) return { times: [], live: isLive(), error: "Choose a package and a date first." };
  const found = findBookable(parsed.data.slug);
  if (!found || !validQuantity(found.pkg, parsed.data.qty)) return { times: [], live: isLive(), error: "Choose a package first." };
  if (!isLive()) return { times: previewTimes(parsed.data.day, found.pkg, parsed.data.qty), live: false };
  const { data, error } = await publicDb().rpc("get_open_times", {
    day: parsed.data.day,
    package_slug: parsed.data.slug,
    qty: found.pkg.priceType === "hourly" || found.pkg.priceType === "per_image" ? parsed.data.qty : null,
  });
  if (error || !data) return { times: [], live: true, error: "Times couldn't load. Please try again." };
  return { times: (data as string[]).map((t) => new Date(t).toISOString()), live: true };
}

// ---------------------------------------------------------------- request

const fieldsSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name.").max(200, "Please shorten your name."),
  email: z.string().trim().email("Please enter an email address like name@example.com.").max(254),
  phone: z
    .string()
    .trim()
    .max(40, "Please shorten the phone number.")
    .regex(/^[0-9+().\-\s]*$/, "Use numbers, spaces and + ( ) - only."),
  location: z.string().trim().min(1, "Please tell me where the session will be.").max(500, "Please shorten the location."),
  notes: z.string().trim().max(3000, "Please keep this under 3,000 characters."),
  terms: z.literal("on", { message: "Please confirm you've read the booking policies." }),
});

const requestSchema = z.object({
  package_slug: z.string().max(60),
  quantity: z.number().int().positive().max(500).nullable(),
  starts_at: z.string().datetime({ offset: true }),
  idempotency_key: z.string().uuid(),
  addons: z.array(z.string().max(80)).max(10),
});

type Field = keyof z.infer<typeof fieldsSchema>;

export type BookingState = {
  status: "idle" | "error" | "not_connected";
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** The chosen time is no longer free: the page reloads the times. */
  timeGone?: boolean;
  /** What was typed, so the form keeps it after an error. */
  values?: { full_name: string; email: string; phone: string; location: string; notes: string; terms: boolean; addons: string[] };
};

const friendly: Record<string, { message: string; timeGone?: boolean }> = {
  TIME_UNAVAILABLE: { message: "That time has just been taken. Please choose another time.", timeGone: true },
  DATE_FULL: { message: "That date has just filled up. Please choose another date.", timeGone: true },
  INVALID_DATE: { message: "Sessions need at least 24 hours' notice. Please choose a later date.", timeGone: true },
  DATE_TOO_FAR: { message: "Bookings open up to two years ahead. Please choose an earlier date." },
  INVALID_PACKAGE: { message: "That package isn't available online. Please choose another." },
  INVALID_QUANTITY: { message: "Please check the number of hours or images." },
  TOO_MANY_REQUESTS: { message: "You've sent several requests today. Please email me instead and I'll help directly." },
  DETAILS_TOO_LONG: { message: "Please shorten your notes." },
  clients_email_check: { message: "Please check your email address." },
};

export async function requestBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Honeypot: real people never fill this hidden field. Pretend it worked.
  if (String(formData.get("website") ?? "")) redirect("/book/requested");
  const values = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    location: String(formData.get("location") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    terms: formData.get("terms") === "on",
    addons: formData.getAll("addons").map(String),
  };
  const fail = (s: Omit<BookingState, "values">): BookingState => ({ ...s, values });

  const fields = fieldsSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    location: String(formData.get("location") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    terms: formData.get("terms") ?? undefined,
  });
  if (!fields.success) {
    const fieldErrors: BookingState["fieldErrors"] = {};
    for (const issue of fields.error.issues) {
      const key = issue.path[0] as Field;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fail({ status: "error", fieldErrors, message: "Please check the highlighted fields." });
  }

  const qtyRaw = String(formData.get("quantity") ?? "");
  const req = requestSchema.safeParse({
    package_slug: String(formData.get("package") ?? ""),
    quantity: qtyRaw ? Number(qtyRaw) : null,
    starts_at: String(formData.get("starts_at") ?? ""),
    idempotency_key: String(formData.get("idempotency_key") ?? ""),
    addons: formData.getAll("addons").map(String),
  });
  if (!req.success) return fail({ status: "error", message: "Please choose a package, a date and a time." });
  const found = findBookable(req.data.package_slug);
  if (!found || !validQuantity(found.pkg, req.data.quantity)) {
    return fail({ status: "error", message: "Please choose a package (and the number of hours or images)." });
  }
  const allowedAddons = new Set(services[found.service].addons.map((a) => a.name));
  const addons = req.data.addons.filter((a) => allowedAddons.has(a));

  const h = await headers();
  const human = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? "") || null, h.get("x-forwarded-for"));
  if (!human) return fail({ status: "error", message: "We couldn't confirm you're not a bot. Please try again." });

  if (!isLive()) return fail({ status: "not_connected" });

  const { data, error } = await publicDb().rpc("request_booking", {
    p: {
      package_slug: req.data.package_slug,
      quantity: req.data.quantity,
      starts_at: req.data.starts_at,
      email: fields.data.email,
      full_name: fields.data.full_name,
      phone: fields.data.phone,
      location: fields.data.location,
      idempotency_key: req.data.idempotency_key,
      details: { notes: fields.data.notes, addons_requested: addons },
    },
  });
  if (error || !data?.[0]) {
    const key = Object.keys(friendly).find((k) => error?.message?.includes(k));
    if (key) return fail({ status: "error", ...friendly[key] });
    return fail({ status: "error", message: "Your request didn't send. Please try again. If it keeps happening, email cjokoro20@gmail.com." });
  }
  redirect(`/book/requested?ref=${encodeURIComponent(data[0].reference)}`);
}
