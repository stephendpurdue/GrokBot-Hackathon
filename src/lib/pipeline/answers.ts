import type { AnswerInput } from "../contract/schema";
import { tryDb } from "./db";

const QUESTIONS = {
  building: "What are you building?",
  wants: "What do you want help with?",
  offers: "What can you help others with?",
  talk: "What would you talk about for 10 minutes?",
} as const;

function tags(values: string[]) {
  return values.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

export async function saveAnswer(input: AnswerInput) {
  const db = tryDb();
  if (!db) throw new Error("supabase not configured");

  const { data: communities, error: communityError } = await db
    .from("communities")
    .select("id")
    .eq("slug", "southbank")
    .limit(1);
  if (communityError) throw new Error(communityError.message);
  const community = communities?.[0] as { id: string } | undefined;
  if (!community) return;

  const tagSets = {
    offers: tags(input.tags.offers),
    wants: tags(input.tags.wants),
    builds: tags(input.tags.builds),
    talks: tags(input.tags.talks),
  };
  const { data: existing, error: lookupError } = await db
    .from("members")
    .select("id")
    .eq("community_id", community.id)
    .eq("handle", input.handle)
    .limit(1);
  if (lookupError) throw new Error(lookupError.message);

  let memberId = (existing?.[0] as { id: string } | undefined)?.id;
  if (!memberId) {
    const { data: created, error: insertError } = await db
      .from("members")
      .insert({
        community_id: community.id,
        display_name: input.handle,
        handle: input.handle,
        consent_intros: input.consentIntros,
        ...tagSets,
        links: input.links ?? {},
      })
      .select("id")
      .single();
    if (insertError || !created) throw new Error(insertError?.message ?? "member missing");
    memberId = (created as { id: string }).id;
  } else {
    const { error: updateError } = await db
      .from("members")
      .update({
        consent_intros: input.consentIntros,
        ...tagSets,
        ...(input.links ? { links: input.links } : {}),
      })
      .eq("id", memberId);
    if (updateError) throw new Error(updateError.message);
  }

  const rows = (Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).map((key) => ({
    member_id: memberId,
    question_key: key,
    question: QUESTIONS[key],
    answer: input.answers[key],
  }));
  const { error: answerError } = await db.from("answers").upsert(rows, { onConflict: "member_id,question_key" });
  if (answerError) throw new Error(answerError.message);
}
