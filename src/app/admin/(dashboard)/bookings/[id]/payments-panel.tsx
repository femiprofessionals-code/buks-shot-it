"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { newPaymentLink, recordManualPayment, type BookingActionResult } from "../actions";

const field = "h-11 w-full rounded-[2px] border border-[#cfc6b7] bg-white px-3 text-[15px] focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";
const secondary = "inline-flex h-11 items-center justify-center rounded-[2px] border border-[#cfc6b7] bg-white px-4 text-[13px] text-charcoal hover:border-charcoal disabled:opacity-60";

export function PaymentsPanel({ id, canRecord, canLink, suggestedKind }: { id: string; canRecord: boolean; canLink: boolean; suggestedKind: "retainer" | "balance" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<(BookingActionResult & { url?: string }) | null>(null);
  const [kind, setKind] = useState<string>(suggestedKind);
  const [dollars, setDollars] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${result?.ok ? "text-success" : "text-error"}`}>
        {pending ? "Saving…" : (result?.message ?? result?.error)}
      </p>
      {result?.url ? (
        <div className="flex flex-col gap-2 rounded border border-sand bg-linen p-3">
          <label htmlFor="pl-url" className="text-sm font-medium">Payment link (shown once)</label>
          <div className="flex gap-2">
            <input id="pl-url" readOnly value={result.url} className={`${field} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={secondary} onClick={() => navigator.clipboard.writeText(result.url!).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      ) : null}

      {canLink ? (
        <section className="flex flex-col gap-2 rounded border border-sand bg-white p-5">
          <h3 className="font-sans text-base font-semibold">Payment link</h3>
          <p className="text-sm text-stone">Creates a new link to the client&apos;s payment page and emails it to them. Use it if they lost the email or to request the balance.</p>
          <button type="button" disabled={pending} className={secondary} onClick={() => start(async () => { setCopied(false); const r = await newPaymentLink({ id }); setResult(r); if (r.ok) router.refresh(); })}>
            Create and send a new link
          </button>
        </section>
      ) : null}

      {canRecord ? (
        <form
          className="flex flex-col gap-2.5 rounded border border-sand bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await recordManualPayment({ id, kind, dollars, note });
              setResult(r);
              if (r.ok) {
                setDollars("");
                setNote("");
                router.refresh();
              }
            });
          }}
        >
          <h3 className="font-sans text-base font-semibold">Record a payment received another way</h3>
          <p className="text-sm text-stone">Cash, Zelle or bank transfer. A retainer or full payment confirms the booking.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mp-kind" className="text-sm font-medium">For</label>
              <select id="mp-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
                <option value="retainer">Retainer</option>
                <option value="full">Payment in full</option>
                <option value="balance">Balance</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mp-amount" className="text-sm font-medium">Amount ($)</label>
              <input id="mp-amount" inputMode="decimal" required value={dollars} onChange={(e) => setDollars(e.target.value)} className={field} placeholder="e.g. 262.50" />
            </div>
          </div>
          <label htmlFor="mp-note" className="text-sm font-medium">How it was paid <span className="font-normal text-stone">(optional)</span></label>
          <input id="mp-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="e.g. Zelle, 12 June" />
          <button type="submit" disabled={pending || !dollars} className={secondary}>Record payment</button>
        </form>
      ) : null}
    </div>
  );
}
