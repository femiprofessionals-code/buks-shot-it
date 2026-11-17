import "server-only";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; email: string };

/**
 * Every admin page and admin Server Action calls this first.
 * Requires: a valid session (checked with Supabase, not just the cookie),
 * a second factor (authenticator app, AAL2), and the admin role in the database.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) redirect("/admin/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    redirect(aal?.nextLevel === "aal2" ? "/admin/mfa" : "/admin/mfa/setup");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/admin/login?error=not_admin");

  return { id: userData.user.id, email: userData.user.email ?? "" };
}

/** Same checks for Server Actions: throws instead of redirecting. */
export async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!userData.user || aal?.currentLevel !== "aal2" || isAdmin !== true) {
    throw new Error("FORBIDDEN");
  }
  return supabase;
}

/**
 * For admin pages: checks access again next to the data (layouts alone aren't a security boundary)
 * and returns the user's Supabase client. Null when Supabase isn't configured; the layout explains that.
 */
export async function adminPageClient() {
  if (!supabaseConfigured) return null;
  await requireAdmin();
  return createSupabaseServerClient();
}
