import "server-only";
// One entry point for everything the voice assistant says: the /today greeting, the per-screen line of the floating
// orb, and answers to a spoken/typed question. Facts come from memory + connector status; an LLM (Anthropic) is used
// only when a model key (OPENAI_API_KEY or ANTHROPIC_API_KEY) is set, and only to phrase those facts. Without it, questions get an honest reply.
import { listIntegrations } from "@/lib/live/integrations";
import { memoryStore, recordMemory } from "@/lib/memory/store";
import { composeGreeting, rephraseWithLlm, stripSalutation, type Greeting } from "./greeting";
import { composeScreenLine, type ScreenContext } from "./screen";
import { googleConfig, GoogleApiError } from "@/lib/google/oauth";
import { listInboxThreads } from "@/lib/google/gmail";
import { listUpcoming } from "@/lib/google/calendar";
import { modelFromEnv } from "@/lib/agent/model";
import { withResilience } from "@/lib/resilience";

const INBOX_MAX = 10; // threads read for the greeting
const MEETINGS_MAX = 3;
const why = (e: unknown) => (e instanceof GoogleApiError || e instanceof Error ? e.message : String(e));

const RECENT = 200; // events read per brief

/** `tz` / `hour`: the client's IANA time zone and local hour (validated in the route); only the Today greeting uses them. */
export async function buildBrief(ctx: ScreenContext & { question?: string | null; tz?: string | null; hour?: number | null }): Promise<Greeting> {
  const m = memoryStore();
  let memory: Parameters<typeof composeGreeting>[0]["memory"];
  if (m.status !== "ok") memory = m;
  else {
    try { memory = { status: "ok", events: await m.store.list({ limit: RECENT }) }; }
    catch (e) { memory = { status: "error", reason: `memory store error: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  const connectors = await listIntegrations(process.env, fetch);
  let inbox: Parameters<typeof composeGreeting>[0]["inbox"], meetings: Parameters<typeof composeGreeting>[0]["meetings"];
  const google = googleConfig();
  if (ctx.screen === "today" && google) {
    // "overnight" = since the last greeting that was actually played (from memory); first time: the latest threads
    const lastPlayed = memory.status === "ok" ? [...memory.events].reverse().find((e) => e.kind === "greeting.played")?.at ?? null : null;
    const [i, m] = await Promise.allSettled([listInboxThreads(google, { after: lastPlayed ? new Date(lastPlayed) : null, max: INBOX_MAX }), listUpcoming(google, { from: new Date(), max: MEETINGS_MAX })]);
    inbox = i.status === "fulfilled" ? { status: "ok", items: i.value.threads, since: lastPlayed } : { status: "error", reason: why(i.reason) };
    meetings = m.status === "fulfilled" ? { status: "ok", items: m.value } : { status: "error", reason: why(m.reason) };
  }
  // only the Today greeting opens with a salutation; every other screen (and any answer) starts with its content
  const greet = ctx.screen === "today" && !ctx.question;
  const draft = greet
    ? composeGreeting({ name: process.env.DEALDESK_GREETING_NAME?.trim() || null, memory, connectors, inbox, meetings, tz: ctx.tz, hour: ctx.hour })
    : composeScreenLine(ctx, memory, connectors);
  const llm = !!modelFromEnv(process.env);
  let text = draft.text, composer: Greeting["composer"] = "deterministic", llmError: string | undefined;
  if (ctx.question && !llm) text = `I heard: “${ctx.question}”. I can't answer free-form questions yet: no AI model is connected. Here's what I know: ${draft.text}`;
  if (llm) {
    // bounded: a slow or down model falls back to the deterministic draft (same facts) with the reason in llmError
    const facts = { ...draft.facts, ...(ctx.question ? { question: ctx.question } : {}) };
    try {
      text = await withResilience(({ signal }) => rephraseWithLlm(draft.text, facts, process.env, ((u, i) => fetch(u, { ...i, signal })) as typeof fetch, { greet }), { label: "AI model (voice phrasing)", timeoutMs: 12_000, deadlineMs: 20_000, retries: 1 });
      composer = "llm";
    }
    catch (e) { llmError = e instanceof Error ? e.message : String(e); }
  }
  if (!greet) text = stripSalutation(text);
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
