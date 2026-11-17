import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/lib/env";

/** Supabase client acting as the signed-in user. Row Level Security applies. */
export async function createSupabaseServerClient() {
  if (!supabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes cookies instead.
        }
      },
    },
  });
}

/** Anonymous client for public reads (published portfolio). Row Level Security applies. */
export function createSupabasePublicClient() {
  if (!supabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return createPlainClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
}

/** Service-role client for scheduled jobs and webhooks only. Bypasses Row Level Security. */
export function createSupabaseServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfigured || !key) throw new Error("SUPABASE_SERVICE_NOT_CONFIGURED");
  return createPlainClient(env.supabaseUrl, key, { auth: { persistSession: false } });
}
