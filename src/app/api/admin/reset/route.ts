import { resetDemoData } from "@/lib/pipeline/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let secret = "";
  try {
    const body = (await request.json()) as { secret?: unknown };
    secret = typeof body.secret === "string" ? body.secret : "";
  } catch {
    return Response.json({ message: "invalid JSON" }, { status: 400 });
  }
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ message: "unauthorized" }, { status: 401 });
  }
  try {
    await resetDemoData();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
