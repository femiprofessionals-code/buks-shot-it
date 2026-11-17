"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth";

export type BookingActionResult = { ok: boolean; error?: string; message?: string };

const uuid = z.string().uuid();

function friendly(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("CAPACITY_EXCEEDED")) return "That date is already full (two sessions, or a whole-day booking). Reschedule or decline instead.";
  if (m.includes("bookings_no_overlap") || m.includes("TIME_TAKEN")) return "That time overlaps another session, including the hour's gap between sessions.";
  if (m.includes("TOTAL_REQUIRED")) return "Enter the total for this quote before approving it.";
  if (m.includes("NOT_PENDING")) return "This request has already been answered. Reload to see its current status.";
  if (m.includes("NOT_RESCHEDULABLE")) return "Only open requests and upcoming bookings can be rescheduled.";
  if (m.includes("NOT_CANCELLABLE")) return "This booking is already closed.";
  if (m.includes("INVALID_DATE")) return "Choose a date and time in the future.";
  if (m.includes("HOLD_EXPIRED")) return "The payment hold on this booking has run out.";
  if (m.includes("FORBIDDEN")) return "You don't have permission to do that.";
  return "Something went wrong. Please try again.";
}

export async function approveBooking(input: { id: string; totalDollars?: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  const id = uuid.parse(input.id);
  let total: number | undefined;
  if (input.totalDollars && input.totalDollars.trim()) {
    const n = Number(input.totalDollars.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100000) return { ok: false, error: "Enter the total in dollars, for example 1200." };
    total = Math.round(n * 100);
  }
  const { error } = await supabase.rpc("approve_booking", { b_id: id, total: total ?? null });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Approved. The client is emailed a link to pay the retainer, and the date is held for 72 hours." };
}

export async function declineBooking(input: { id: string; reason: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  const reason = z.string().trim().max(1000).parse(input.reason);
  const { error } = await supabase.rpc("decline_booking", { b_id: uuid.parse(input.id), reason: reason || null });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Declined. The client is told by email." };
}

export async function rescheduleBooking(input: { id: string; local: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and a time.").safeParse(input.local);
  if (!local.success) return { ok: false, error: "Choose a date and a time." };
  const { error } = await supabase.rpc("reschedule_booking", { b_id: uuid.parse(input.id), new_local: `${local.data.replace("T", " ")}:00` });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Moved. The client is emailed the new date and time." };
}

export async function cancelBooking(input: { id: string; reason: string; confirm: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  if (input.confirm !== "CANCEL") return { ok: false, error: "Type CANCEL to confirm." };
  const reason = z.string().trim().max(1000).parse(input.reason);
  const { error } = await supabase.rpc("cancel_booking", { b_id: uuid.parse(input.id), reason: reason || null });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Cancelled. The client is told by email. Any retainer paid is not refunded automatically." };
}

// ---------------------------------------------------------------- blocked dates

const dayRe = /^\d{4}-\d{2}-\d{2}$/;

export async function blockDate(input: { day: string; reason: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  if (!dayRe.test(input.day)) return { ok: false, error: "Choose a date." };
  const reason = z.string().trim().max(200).parse(input.reason);
  const { error } = await supabase.from("blocked_dates").upsert({ day: input.day, reason: reason || null });
  if (error) return { ok: false, error: friendly(error) };
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_date", input.day)
    .in("status", ["pending", "approved", "awaiting_payment", "confirmed", "rescheduled"]);
  return {
    ok: true,
    message: count ? `Blocked. Note: ${count} existing request${count === 1 ? "" : "s"} or booking${count === 1 ? "" : "s"} on this date ${count === 1 ? "is" : "are"} unchanged.` : "Blocked. No new requests can be made for this date.",
  };
}

export async function unblockDate(input: { day: string }): Promise<BookingActionResult> {
  const supabase = await assertAdmin();
  if (!dayRe.test(input.day)) return { ok: false, error: "Invalid date." };
  const { error } = await supabase.from("blocked_dates").delete().eq("day", input.day);
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, message: "Unblocked." };
}
