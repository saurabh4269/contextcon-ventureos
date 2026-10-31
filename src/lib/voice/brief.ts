import "server-only";
// One entry point for everything the voice assistant says: the /today greeting, the per-screen line of the floating
// orb, and answers to a spoken/typed question. Facts come from memory + connector status; an LLM (Anthropic) is used
// only when ANTHROPIC_API_KEY is set, and only to phrase those facts. Without it, questions get an honest reply.
import { listIntegrations } from "@/lib/live/integrations";
import { memoryStore, recordMemory } from "@/lib/memory/store";
import { composeGreeting, rephraseWithLlm, type Greeting } from "./greeting";
import { composeScreenLine, type ScreenContext } from "./screen";

const RECENT = 200; // events read per brief

export async function buildBrief(ctx: ScreenContext & { question?: string | null }): Promise<Greeting> {
  const m = memoryStore();
  let memory: Parameters<typeof composeGreeting>[0]["memory"];
  if (m.status !== "ok") memory = m;
  else {
    try { memory = { status: "ok", events: await m.store.list({ limit: RECENT }) }; }
    catch (e) { memory = { status: "error", reason: `memory store error: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  const connectors = await listIntegrations(process.env, fetch);
  const draft = ctx.screen === "today" && !ctx.question
    ? composeGreeting({ name: process.env.DEALDESK_GREETING_NAME?.trim() || null, memory, connectors })
    : composeScreenLine(ctx, memory, connectors);
  const llm = !!process.env.ANTHROPIC_API_KEY?.trim();
  let text = draft.text, composer: Greeting["composer"] = "deterministic", llmError: string | undefined;
  if (ctx.question && !llm) text = `I heard: “${ctx.question}”. I can't answer free-form questions yet: no AI model is connected. Here's what I know: ${draft.text}`;
  if (llm) {
    try { text = await rephraseWithLlm(draft.text, { ...draft.facts, ...(ctx.question ? { question: ctx.question } : {}) }, process.env); composer = "llm"; }
    catch (e) { llmError = e instanceof Error ? e.message : String(e); }
  }
  const kind = ctx.question ? "assistant.asked" : ctx.screen === "today" ? "greeting.generated" : "assistant.brief";
  await recordMemory({
    kind,
    actor: { type: "agent", name: "Voice assistant" },
    subject: ctx.subject ? { type: ctx.screen === "person" ? "person" : "company", id: ctx.subject } : null,
    summary: ctx.question ? `Asked on ${ctx.screen}: “${ctx.question.slice(0, 120)}”` : ctx.screen === "today" ? `Composed the Today greeting (${composer})` : `Spoke a brief on ${ctx.screen}${ctx.subject ? ` (${ctx.subject})` : ""}`,
    data: { text, composer, sources: draft.sources },
    source: "api:/api/voice/brief",
  });
  return { status: "ok", text, composer, ...(llmError ? { llmError } : {}), sources: draft.sources, facts: draft.facts, generatedAt: new Date().toISOString() };
}
