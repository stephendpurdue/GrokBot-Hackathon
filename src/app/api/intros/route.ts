import { AsOf } from "@/lib/contract/schema";
import { getIntros } from "@/lib/pipeline/intros";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const week = new URL(request.url).searchParams.get("week");
  const parsed = AsOf.safeParse(week);
  if (!parsed.success) return Response.json({ message: "week must be YYYY-MM-DD" }, { status: 400 });
  try {
    return Response.json({ intros: await getIntros(parsed.data) });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
