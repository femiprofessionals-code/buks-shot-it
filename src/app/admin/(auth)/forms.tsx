"use client";

import { useActionState, useEffect, useState } from "react";
import { finishMfaSetup, signIn, startMfaSetup, verifyMfa, type AuthState } from "./actions";

const input = "h-12 w-full rounded-[2px] border border-[#cfc6b7] bg-white px-3.5 text-base focus:border-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal";
const button = "h-12 w-full rounded-[2px] bg-charcoal text-[13px] font-medium uppercase tracking-[0.12em] text-ivory hover:bg-[#2e2c29] disabled:opacity-60";

function FormError({ text }: { text?: string }) {
  return <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-error">{text}</p>;
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="text-3xl">Sign in</h1>
      {notice ? <p className="text-sm text-warning">{notice}</p> : null}
      <div className="flex flex-col gap-2"><label htmlFor="a-email" className="text-sm font-medium">Email address</label><input id="a-email" name="email" type="email" autoComplete="username" required className={input} /></div>
      <div className="flex flex-col gap-2"><label htmlFor="a-password" className="text-sm font-medium">Password</label><input id="a-password" name="password" type="password" autoComplete="current-password" required className={input} /></div>
      <FormError text={state.error} />
      <button type="submit" disabled={pending} className={button}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function MfaForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyMfa, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="text-3xl">Enter your code</h1>
      <p className="text-[15px] text-ink-soft">Open your authenticator app and enter the 6-digit code for Buks Shot It.</p>
      <div className="flex flex-col gap-2"><label htmlFor="a-code" className="text-sm font-medium">6-digit code</label><input id="a-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={`${input} tracking-[0.3em]`} /></div>
      <FormError text={state.error} />
      <button type="submit" disabled={pending} className={button}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function MfaSetupForm() {
  const [setup, setSetup] = useState<AuthState | null>(null);
  const [state, action, pending] = useActionState<AuthState, FormData>(finishMfaSetup, {});
  useEffect(() => {
    startMfaSetup().then(setSetup);
  }, []);
  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="text-3xl">Protect your account</h1>
      <p className="text-[15px] text-ink-soft">Scan this code with an authenticator app (Google Authenticator, 1Password or Authy), then enter the 6-digit code it shows. You&apos;ll need it each time you sign in.</p>
      {setup?.qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- QR code is a data URL from Supabase
        <img src={setup.qr} alt="QR code to add Buks Shot It to your authenticator app" width={200} height={200} className="self-center" />
      ) : (
        <p className="text-sm text-stone">{setup?.error ?? "Preparing your code…"}</p>
      )}
      {setup?.secret ? <p className="break-all text-xs text-stone">Can&apos;t scan? Enter this key in the app: <code>{setup.secret}</code></p> : null}
      <input type="hidden" name="factorId" value={setup?.factorId ?? state.factorId ?? ""} />
      <div className="flex flex-col gap-2"><label htmlFor="a-setup-code" className="text-sm font-medium">6-digit code</label><input id="a-setup-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={`${input} tracking-[0.3em]`} /></div>
      <FormError text={state.error} />
      <button type="submit" disabled={pending || !setup?.factorId} className={button}>{pending ? "Checking…" : "Turn on and continue"}</button>
    </form>
  );
}
