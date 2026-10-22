import { IntroRunInput } from "@/lib/contract/schema";
import { runIntros } from "@/lib/pipeline/intros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function londonToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export async function POST(request: Request) {
  let body: unknown = {};
  if (request.headers.get("content-length") !== "0") {
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "invalid JSON" }, { status: 400 });
    }
  }
  const parsed = IntroRunInput.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.message }, { status: 400 });

  const asOf = parsed.data.asOf ?? londonToday();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        let last = Date.now();
        const result = await runIntros(asOf, (step) => {
          const now = Date.now();
          send({ step, status: "ok", ms: now - last });
          last = now;
        });
        send({ step: "done", status: "ok", data: result });
      } catch (error) {
        send({
          step: "error",
          status: "error",
          data: { message: error instanceof Error ? error.message : "intro run failed" },
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
