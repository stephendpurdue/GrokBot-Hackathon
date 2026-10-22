import { SpeakerInput, SpeakerResult } from "@/lib/contract/schema";
import { findSpeakers } from "@/lib/pipeline/speakers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid JSON" }, { status: 400 });
  }
  const parsed = SpeakerInput.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.message }, { status: 400 });
  try {
    const result = SpeakerResult.parse(await findSpeakers(parsed.data.topic));
    return Response.json(result);
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
