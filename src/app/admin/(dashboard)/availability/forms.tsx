"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { blockDate, unblockDate, type BookingActionResult } from "../bookings/actions";

const field = "h-11 rounded-[2px] border border-[#cfc6b7] bg-white px-3 text-[15px] focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";

export function BlockDateForm({ min }: { min: string }) {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await blockDate({ day, reason });
          setResult(r);
          if (r.ok) {
            setDay("");
            setReason("");
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-3 rounded border border-sand bg-white p-5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5"><label htmlFor="bd-day" className="text-sm font-medium">Date</label><input id="bd-day" type="date" required min={min} value={day} onChange={(e) => setDay(e.target.value)} className={field} /></div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5"><label htmlFor="bd-reason" className="text-sm font-medium">Note <span className="font-normal text-stone">(only you see it)</span></label><input id="bd-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} w-full`} /></div>
        <button type="submit" disabled={pending || !day} className="inline-flex h-11 items-center rounded-[2px] bg-charcoal px-5 text-[13px] font-medium uppercase tracking-[0.12em] text-ivory hover:bg-[#2e2c29] disabled:opacity-60">Block date</button>
      </div>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${result?.ok ? "text-success" : "text-error"}`}>{result?.message ?? result?.error}</p>
    </form>
  );
}

export function UnblockButton({ day }: { day: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { const r = await unblockDate({ day }); if (r.ok) router.refresh(); })}
      className="h-9 rounded-[2px] border border-[#cfc6b7] px-3 text-[13px] hover:border-charcoal disabled:opacity-60"
    >
      {pending ? "Removing…" : "Unblock"}
    </button>
  );
}
