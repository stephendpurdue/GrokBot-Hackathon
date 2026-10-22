import { listAttempts } from "@/lib/pipeline/speakers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ attempts: await listAttempts() });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
