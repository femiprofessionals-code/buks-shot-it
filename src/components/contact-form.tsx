"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendEnquiry, type ContactState } from "@/app/contact/actions";
import { site } from "@/content/site";

const topics = [
  ["weddings", "Weddings"],
  ["portraits", "Portraits"],
  ["events", "Events"],
  ["products", "Products"],
  ["licensing", "Licensing"],
  ["other", "Something else"],
] as const;

const input =
  "h-12 w-full rounded-[2px] border bg-white px-3.5 text-base text-charcoal focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";

export function ContactForm() {
  const params = useSearchParams();
  const presetTopic = params.get("topic") ?? "";
  const presetSession = params.get("session");
  const [state, action, pending] = useActionState<ContactState, FormData>(sendEnquiry, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-3.5 py-6">
        <h2 className="text-4xl">Message sent.</h2>
        <p className="text-[17px] leading-relaxed">Thank you. I&apos;ll reply by email to {state.values?.email ?? "you"}.</p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const field = (name: "name" | "email" | "topic" | "message") => ({
    "aria-invalid": err[name] ? true : undefined,
    "aria-describedby": err[name] ? `${name}-error` : undefined,
    className: `${input} ${err[name] ? "border-error" : "border-[#cfc6b7]"}`,
  });

  return (
    <form action={action} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="c-name" className="text-sm font-medium">Your name</label>
        <input id="c-name" name="name" autoComplete="name" required defaultValue={v.name} {...field("name")} />
        {err.name ? <p id="name-error" className="text-[13px] text-error">{err.name}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="c-email" className="text-sm font-medium">Email address</label>
        <input id="c-email" name="email" type="email" autoComplete="email" required defaultValue={v.email} {...field("email")} />
        {err.email ? <p id="email-error" className="text-[13px] text-error">{err.email}</p> : null}
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="c-topic" className="text-sm font-medium">What&apos;s it about?</label>
        <select id="c-topic" name="topic" required defaultValue={v.topic ?? presetTopic} {...field("topic")}>
          <option value="" disabled>Choose one</option>
          {topics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {err.topic ? <p id="topic-error" className="text-[13px] text-error">{err.topic}</p> : null}
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="c-message" className="text-sm font-medium">Your message</label>
        <textarea
          id="c-message"
          name="message"
          required
          rows={6}
          defaultValue={v.message ?? (presetSession ? `I'd like to ask about: ${presetSession}.\n\n` : "")}
          {...field("message")}
          className={`${field("message").className} h-auto py-3`}
        />
        {err.message ? <p id="message-error" className="text-[13px] text-error">{err.message}</p> : null}
      </div>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="c-website">Leave this empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center rounded-[2px] bg-charcoal px-7 text-[13px] font-medium uppercase tracking-[0.12em] text-ivory hover:bg-[#2e2c29] disabled:opacity-60">
          {pending ? "Sending…" : "Send message"}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {state.status === "error" && state.message ? <span className="text-error">{state.message}</span> : null}
          {state.status === "not_connected" ? (
            <span className="text-warning">
              The form isn&apos;t connected yet (preview site), so your message wasn&apos;t sent. Please email {site.email}.
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
