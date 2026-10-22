import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "./env";

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key || key.startsWith("#") || key.length < 20) {
    throw new Error("supabase not configured: set SUPABASE_SERVICE_ROLE_KEY to the secret key");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const table of ["speaker_picks", "speaker_runs", "intros", "attempts", "revives"]) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`cleared ${table}`);
  }
  const { count, error } = await supabase.from("members").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  console.log(`members kept: ${count ?? 0}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
