import { AnswerInput } from "@/lib/contract/schema";
import { saveAnswer } from "@/lib/pipeline/answers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret") ?? "";
  const expected = process.env.WEBHOOK_SECRET ?? "";
  if (!expected || secret !== expected) {
    return Response.json({ message: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid JSON" }, { status: 400 });
  }
  const parsed = AnswerInput.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.message }, { status: 400 });
  try {
    await saveAnswer(parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
