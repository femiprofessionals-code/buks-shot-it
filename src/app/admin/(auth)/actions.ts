"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; qr?: string; secret?: string; factorId?: string };

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!supabaseConfigured) return { error: "Sign-in isn't connected yet. Supabase still needs to be set up." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for every failure, so the form never reveals which emails have accounts.
  if (error) return { error: "That email and password don't match. Please try again." };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/admin/mfa" : aal?.currentLevel === "aal2" ? "/admin" : "/admin/mfa/setup");
}

export async function signOut() {
  if (supabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

const codeSchema = z.string().regex(/^\d{6}$/);

/** Second step of sign-in: a 6-digit code from the authenticator app. */
export async function verifyMfa(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const code = codeSchema.safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!code.success) return { error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/admin/mfa/setup");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) return { error: "That code didn't work. Codes change every 30 seconds; try the current one." };
  redirect("/admin");
}

/** First sign-in: create an authenticator-app factor and show its QR code. */
export async function startMfaSetup(): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/admin/login");
  // Remove unfinished factors from earlier attempts.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Buks Shot It admin" });
  if (error || !data) return { error: "Couldn't start setup. Please reload the page." };
  return { qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id };
}

export async function finishMfaSetup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = codeSchema.safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!code.success || !factorId) return { error: "Enter the 6-digit code shown in your authenticator app.", factorId };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { error: "That code didn't work. Try the current code in the app.", factorId };
  redirect("/admin");
}
