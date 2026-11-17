import "server-only";

/** Server-side configuration. Secrets are read here only, never in client code. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",
};

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
