/**
 * Booking logic tests. Time-zone helpers and validation run for real; for the server action,
 * the database is replaced by a stand-in (the real database rules are tested in supabase/tests).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let live = true;

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/lib/booking", async (orig) => {
  const real = await orig<typeof import("@/lib/booking")>();
  return { ...real, isLive: () => live, publicDb: () => ({ rpc }) };
});

import { findBookable, localToIso, previewTimes, sessionMinutes, validQuantity, zoneOffset } from "@/lib/booking";
import { requestBooking } from "@/app/(site)/book/actions";

describe("time zone", () => {
  it("uses Eastern Daylight Time in summer and Eastern Standard Time in winter", () => {
    expect(zoneOffset("2027-06-12")).toBe("-04:00");
    expect(zoneOffset("2027-01-12")).toBe("-05:00");
  });
  it("turns a studio-local start into the right instant", () => {
    expect(localToIso("2027-06-12", 14 * 60 + 30)).toBe("2027-06-12T18:30:00.000Z");
    expect(localToIso("2027-01-12", 9 * 60)).toBe("2027-01-12T14:00:00.000Z");
  });
  it("handles the day clocks change (DST starts 14 March 2027)", () => {
    expect(localToIso("2027-03-14", 10 * 60)).toBe("2027-03-14T14:00:00.000Z");
  });
});

describe("packages and quantities", () => {
  it("only offers packages that can be booked online", () => {
    expect(findBookable("wedding-classic")?.service).toBe("weddings");
    expect(findBookable("event-hourly")?.service).toBe("events");
    expect(findBookable("portrait-family")).toBeNull();
    expect(findBookable("nope")).toBeNull();
  });
  it("matches the database's session lengths", () => {
    expect(sessionMinutes(findBookable("wedding-classic")!.pkg, null)).toBe(360);
    expect(sessionMinutes(findBookable("event-full-day")!.pkg, null)).toBe(720);
    expect(sessionMinutes(findBookable("event-hourly")!.pkg, 3)).toBe(180);
    expect(sessionMinutes(findBookable("product-standard")!.pkg, null)).toBe(120);
  });
  it("matches the database's quantity rules", () => {
    const hourly = findBookable("event-hourly")!.pkg;
    const images = findBookable("product-simple")!.pkg;
    expect([validQuantity(hourly, null), validQuantity(hourly, 0), validQuantity(hourly, 2.5), validQuantity(hourly, 13), validQuantity(hourly, 12)]).toEqual([false, false, false, false, true]);
    expect([validQuantity(images, 501), validQuantity(images, 1)]).toEqual([false, true]);
  });
  it("preview times match the database grid: 7:00 to the last start that ends by midnight, every 30 minutes", () => {
    const t = previewTimes("2030-06-12", findBookable("wedding-classic")!.pkg, null);
    expect(t.length).toBe(23);
    expect(t[0]).toBe("2030-06-12T11:00:00.000Z"); // 7:00 EDT
    expect(t.at(-1)).toBe("2030-06-12T22:00:00.000Z"); // 18:00 EDT
  });
});

function form(over: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const base: Record<string, string | string[]> = {
    package: "event-hourly",
    quantity: "2",
    starts_at: "2030-06-12T18:00:00.000Z",
    idempotency_key: "6f1c2c1e-1d55-4a0c-9d2a-6a1f0f5a1b01",
    full_name: "Jordan Example",
    email: "jordan@example.com",
    phone: "",
    location: "Hall",
    notes: "Speeches at 7",
    terms: "on",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

describe("sending a booking request", () => {
  beforeEach(() => {
    rpc.mockReset();
    live = true;
  });

  it("sends a valid request and goes to the confirmation page with the reference", async () => {
    rpc.mockResolvedValue({ data: [{ booking_id: "x", reference: "AB12CD34" }], error: null });
    await expect(requestBooking({ status: "idle" }, form({ addons: ["Rush delivery (48 hours)", "Made-up add-on"] }))).rejects.toMatchObject({
      url: "/book/requested?ref=AB12CD34",
    });
    const p = rpc.mock.calls[0][1].p;
    expect(rpc.mock.calls[0][0]).toBe("request_booking");
    expect(p).toMatchObject({ package_slug: "event-hourly", quantity: 2, email: "jordan@example.com", location: "Hall" });
    expect(p.details).toEqual({ notes: "Speeches at 7", addons_requested: ["Rush delivery (48 hours)"] }); // unknown add-ons dropped
  });

  it("refuses missing details before touching the database, and keeps what was typed", async () => {
    const r = await requestBooking({ status: "idle" }, form({ full_name: "", email: "nope", terms: "" }));
    expect(r.status).toBe("error");
    expect(Object.keys(r.fieldErrors ?? {})).toEqual(expect.arrayContaining(["full_name", "email", "terms"]));
    expect(r.values?.location).toBe("Hall");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a portrait package or a bad quantity", async () => {
    expect((await requestBooking({ status: "idle" }, form({ package: "portrait-family" }))).status).toBe("error");
    expect((await requestBooking({ status: "idle" }, form({ quantity: "20" }))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains a time that was just taken and asks the page to reload times", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "TIME_UNAVAILABLE" } });
    const r = await requestBooking({ status: "idle" }, form());
    expect(r).toMatchObject({ status: "error", timeGone: true });
    expect(r.message).toMatch(/just been taken/);
  });

  it("never reports success when the database isn't connected", async () => {
    live = false;
    const r = await requestBooking({ status: "idle" }, form());
    expect(r.status).toBe("not_connected");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats a filled spam trap as sent without saving anything", async () => {
    await expect(requestBooking({ status: "idle" }, form({ website: "http://spam" }))).rejects.toMatchObject({ url: "/book/requested" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
