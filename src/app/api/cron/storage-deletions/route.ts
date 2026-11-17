import { timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { deleteObject, storageConfig } from "@/lib/storage";

/**
 * Deletes files queued when photos are removed or replaced.
 * Run by Vercel Cron (vercel.json), which sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!storageConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ skipped: "not configured" });

  const db = createSupabaseServiceClient();
  const { data: jobs, error } = await db
    .from("storage_deletions")
    .select("id, bucket, key, attempts")
    .is("done_at", null)
    .lt("attempts", 5)
    .order("id")
    .limit(200);
  if (error) return Response.json({ error: "queue unavailable" }, { status: 500 });

  let deleted = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      await deleteObject(job.bucket as "public" | "private", job.key);
      await db.from("storage_deletions").update({ done_at: new Date().toISOString() }).eq("id", job.id);
      deleted++;
    } catch (e) {
      await db.from("storage_deletions").update({ attempts: job.attempts + 1, last_error: String(e).slice(0, 500) }).eq("id", job.id);
      failed++;
    }
  }
  return Response.json({ deleted, failed });
}
