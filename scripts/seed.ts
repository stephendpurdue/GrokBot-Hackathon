import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "./env";

const QUESTIONS = {
  building: "What are you building?",
  wants: "What do you want help with?",
  offers: "What can you help others with?",
  talk: "What would you talk about for 10 minutes?",
} as const;

type Seed = {
  community: { name: string; slug: string };
  members: Array<{
    displayName: string;
    handle: string;
    consentIntros: boolean;
    offers: string[];
    wants: string[];
    builds: string[];
    talks: string[];
    links: { github?: string };
    answers: Record<keyof typeof QUESTIONS, string>;
  }>;
  messages: Array<{ threadId: string; handle: string; content: string; createdAt: string }>;
};

function db() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key || key.startsWith("#") || key.length < 20) {
    throw new Error("supabase not configured: set SUPABASE_SERVICE_ROLE_KEY to the secret key");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main() {
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8")) as Seed;
  const supabase = db();
  const { data: community, error: communityError } = await supabase
    .from("communities")
    .upsert(seed.community, { onConflict: "slug" })
    .select("id")
    .single();
  if (communityError || !community) throw new Error(communityError?.message ?? "community missing");

  const { data: members, error: memberError } = await supabase
    .from("members")
    .upsert(
      seed.members.map((member) => ({
        community_id: community.id,
        display_name: member.displayName,
        handle: member.handle,
        consent_intros: member.consentIntros,
        offers: member.offers,
        wants: member.wants,
        builds: member.builds,
        talks: member.talks,
        links: member.links,
      })),
      { onConflict: "community_id,handle" },
    )
    .select("id, handle");
  if (memberError || !members) throw new Error(memberError?.message ?? "members missing");

  const idByHandle = new Map(members.map((member) => [member.handle, member.id]));
  const answers = seed.members.flatMap((member) => {
    const memberId = idByHandle.get(member.handle);
    if (!memberId) throw new Error(`missing handle ${member.handle}`);
    return (Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).map((key) => ({
      member_id: memberId,
      question_key: key,
      question: QUESTIONS[key],
      answer: member.answers[key],
    }));
  });
  const { error: answerError } = await supabase
    .from("answers")
    .upsert(answers, { onConflict: "member_id,question_key" });
  if (answerError) throw new Error(answerError.message);

  const threadIds = [...new Set(seed.messages.map((message) => message.threadId))];
  const { error: deleteError } = await supabase.from("messages").delete().in("thread_id", threadIds);
  if (deleteError) throw new Error(deleteError.message);
  const { error: messageError } = await supabase.from("messages").insert(
    seed.messages.map((message) => ({
      community_id: community.id,
      member_id: idByHandle.get(message.handle),
      thread_id: message.threadId,
      content: message.content,
      created_at: message.createdAt,
    })),
  );
  if (messageError) throw new Error(messageError.message);

  const counts = {
    members: members.length,
    answers: answers.length,
    messages: seed.messages.length,
  };
  console.log(counts);
  if (counts.members !== 12 || counts.answers !== 48 || counts.messages !== 12) {
    throw new Error(`unexpected counts ${JSON.stringify(counts)}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (message.includes("relation") || message.includes("schema cache")) {
    console.error("Apply supabase/migrations/0001_init.sql in the Supabase SQL editor, then rerun.");
  }
  process.exit(1);
});
