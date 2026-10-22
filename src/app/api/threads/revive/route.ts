import { ReviveResult } from "@/lib/contract/schema";
import { reviveThreads } from "@/lib/pipeline/revive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.trim()) {
    try {
      JSON.parse(text);
    } catch {
      return Response.json({ message: "invalid JSON" }, { status: 400 });
    }
  }
  try {
    return Response.json(ReviveResult.parse(await reviveThreads()));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
