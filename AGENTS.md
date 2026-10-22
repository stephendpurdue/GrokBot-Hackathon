- TypeScript strict. No `any` unless commented why.
- Import types and matching from src/lib/contract. Never edit those files.
- Only edit files you own (PLAN.md section 0.4). If you need a change elsewhere, stop and tell the human.
- Never hard-code secrets. Read env vars. SUPABASE_SERVICE_ROLE_KEY is server only.
- Validate external input and LLM output with Zod.
- Do not invent evidence, handles, stars, or events. If a source fails, log an attempt and move on.
- Do not introduce a member with consent_intros = false. Do not commit data/private.
- Keep functions small and typed. No dead code. No unused dependencies.
- After each task: run typecheck and lint, commit with a clear message, and append one entry
  (task id, what was built, one line on the approach) to docs/agent-log.md.
- Do not add features outside your task list. Do not add Cognee, mem0, graphology,
  sentence-transformers, Baileys, or whatsapp-web.js.
