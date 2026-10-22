import { loadPeople, memberView } from "@/lib/pipeline/people";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ members: memberView(await loadPeople()) });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
