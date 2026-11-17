"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env, supabaseConfigured } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";

const topics = ["weddings", "portraits", "events", "products", "licensing", "other"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200, "Please shorten your name."),
  email: z.string().trim().email("Please enter an email address like name@example.com.").max(254),
  topic: z.enum(topics, { message: "Please choose what your message is about." }),
  message: z.string().trim().min(1, "Please write a message.").max(5000, "Please keep your message under 5,000 characters."),
  // Honeypot: real people never fill this hidden field.
  website: z.string().max(0).optional(),
});

export type ContactState = {
  status: "idle" | "sent" | "error" | "not_connected";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "topic" | "message", string>>;
  values?: Partial<Record<"name" | "email" | "topic" | "message", string>>;
};

export async function sendEnquiry(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
  };
  const values = { name: raw.name, email: raw.email, topic: raw.topic, message: raw.message };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ContactState["fieldErrors"]>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    // A filled honeypot is treated as sent, silently.
    if (raw.website) return { status: "sent" };
    return { status: "error", fieldErrors, values };
  }

  const h = await headers();
  const ok = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? "") || null, h.get("x-forwarded-for"));
  if (!ok) return { status: "error", message: "We couldn't confirm you're not a bot. Please try again.", values };

  if (!supabaseConfigured) {
    return { status: "not_connected", values };
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
  const { error } = await supabase.rpc("submit_enquiry", {
    p: { name: parsed.data.name, email: parsed.data.email, topic: parsed.data.topic, message: parsed.data.message },
  });
  if (error) {
    return { status: "error", message: "Your message didn't send. Please try again. If it keeps happening, email cjokoro20@gmail.com.", values };
  }
  return { status: "sent", values: { email: parsed.data.email } };
}
