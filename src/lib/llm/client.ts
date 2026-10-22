import OpenAI from "openai";
import { z } from "zod";

export async function chatJSON<T>({
  schema,
  system,
  user,
}: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
}): Promise<T> {
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "";
  if (!apiKey || !model) throw new Error("llm not configured");

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || undefined,
  });

  const ask = async (prompt: string) => {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("response was not json");
    }
    const result = schema.safeParse(parsed);
    if (!result.success) throw new Error(result.error.message);
    return result.data;
  };

  try {
    return await ask(user);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid";
    return ask(`${user}\n\nPrevious response failed validation: ${reason}`);
  }
}
