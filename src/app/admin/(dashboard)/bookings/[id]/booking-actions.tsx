"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveBooking, cancelBooking, declineBooking, rescheduleBooking, type BookingActionResult } from "../actions";

const field = "h-11 w-full rounded-[2px] border border-[#cfc6b7] bg-white px-3 text-[15px] focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";
const primary = "inline-flex h-11 items-center justify-center rounded-[2px] bg-charcoal px-5 text-[13px] font-medium uppercase tracking-[0.12em] text-ivory hover:bg-[#2e2c29] disabled:opacity-60";
const secondary = "inline-flex h-11 items-center justify-center rounded-[2px] border border-[#cfc6b7] bg-white px-4 text-[13px] text-charcoal hover:border-charcoal disabled:opacity-60";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded border border-sand bg-white p-5">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function BookingActions(props: { id: string; status: string; isQuote: boolean; totalCents: number | null; currentLocal: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [total, setTotal] = useState(props.totalCents != null ? String(props.totalCents / 100) : "");
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(props.currentLocal);
  const [cancelReason, setCancelReason] = useState("");
  const [confirm, setConfirm] = useState("");

  const run = (fn: () => Promise<BookingActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });

  const open = ["pending", "approved", "awaiting_payment", "confirmed", "rescheduled"].includes(props.status);

  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${result?.ok ? "text-success" : "text-error"}`}>
        {pending ? "Saving…" : (result?.message ?? result?.error)}
      </p>

      {props.status === "pending" ? (
        <Panel title="Approve">
          <p className="text-sm text-stone">The client is emailed a link to pay the 35% retainer, and the date is held for 72 hours.</p>
          <label htmlFor="a-total" className="text-sm font-medium">
            Total in dollars {props.isQuote ? "(required for a quote)" : "(change it to include agreed add-ons)"}
          </label>
          <input id="a-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={field} placeholder="e.g. 1200" />
          <button type="button" disabled={pending} onClick={() => run(() => approveBooking({ id: props.id, totalDollars: total }))} className={primary}>
            Approve request
          </button>
        </Panel>
      ) : null}

      {props.status === "pending" ? (
        <Panel title="Decline">
          <label htmlFor="d-reason" className="text-sm font-medium">Message to the client <span className="font-normal text-stone">(optional)</span></label>
          <textarea id="d-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} h-auto py-2`} />
          <button type="button" disabled={pending} onClick={() => run(() => declineBooking({ id: props.id, reason }))} className={secondary}>
            Decline request
          </button>
        </Panel>
      ) : null}

      {open ? (
        <Panel title="Reschedule">
          <p className="text-sm text-stone">Same length of session. Times are Eastern Time. The client is emailed the change.</p>
          <label htmlFor="r-when" className="text-sm font-medium">New date and start time</label>
          <input id="r-when" type="datetime-local" step={900} value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          <button type="button" disabled={pending || when === props.currentLocal} onClick={() => run(() => rescheduleBooking({ id: props.id, local: when }))} className={secondary}>
            Move booking
          </button>
        </Panel>
      ) : null}

      {open ? (
        <Panel title="Cancel">
          <p className="text-sm text-stone">Frees the date. The client is told by email. A paid retainer is not refunded automatically.</p>
          <label htmlFor="c-reason" className="text-sm font-medium">Message to the client <span className="font-normal text-stone">(optional)</span></label>
          <textarea id="c-reason" rows={2} maxLength={1000} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className={`${field} h-auto py-2`} />
          <label htmlFor="c-confirm" className="text-sm">Type CANCEL to confirm</label>
          <input id="c-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={field} />
          <button type="button" disabled={pending || confirm !== "CANCEL"} onClick={() => run(() => cancelBooking({ id: props.id, reason: cancelReason, confirm }))} className={`${secondary} border-error text-error`}>
            Cancel booking
          </button>
        </Panel>
      ) : null}

      {!open ? <p className="text-sm text-stone">This booking is closed. No further actions.</p> : null}
    </div>
  );
}
