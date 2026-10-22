import { supabaseAdmin } from "../db/server";
import { memory } from "./memory";

export function tryDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key || key.startsWith("#") || key.length < 20) return null;
  return supabaseAdmin();
}

export async function resetDemoData() {
  memory.clear();
  const db = tryDb();
  if (!db) return;
  for (const table of ["speaker_picks", "speaker_runs", "intros", "attempts", "revives"] as const) {
    const { error } = await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
