"use client";

import { useActionState } from "react";
import { startCheckout, type PayState } from "./actions";

type Option = { kind: "retainer" | "full" | "balance"; label: string; note: string };

export function PayButtons({ token, options, enabled }: { token: string; options: Option[]; enabled: boolean }) {
  const [state, action, pending] = useActionState<PayState, FormData>(startCheckout, {});
  return (
    <div className="flex flex-col gap-4">
      {options.map((o, i) => (
        <form key={o.kind} action={action} className="flex flex-col gap-1.5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="kind" value={o.kind} />
          <button
            type="submit"
            disabled={pending || !enabled}
            className={`inline-flex h-12 items-center justify-center self-start rounded-[2px] border px-7 text-[12px] font-medium uppercase tracking-[0.18em] disabled:opacity-50 ${
              i === 0 ? "border-transparent bg-ivory text-canvas hover:bg-white" : "border-field text-ivory hover:border-ivory"
            }`}
          >
            {pending ? "Opening secure payment…" : o.label}
          </button>
          <p className="text-[13px] text-muted">{o.note}</p>
        </form>
      ))}
      {!enabled ? <p role="status" className="text-caution">Online payment isn&apos;t connected yet. Please reply to your approval email to arrange payment.</p> : null}
      {state.error ? <p role="alert" className="text-danger">{state.error}</p> : null}
    </div>
  );
}
