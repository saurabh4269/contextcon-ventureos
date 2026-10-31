// The Today voice greeting, composed from REAL data only:
//   - organizational memory (what happened since the last played greeting; the latest deal researched/opened),
//   - connector status (what needs attention; whether inbound sources are connected at all).
// Nothing is canned: every clause comes from a fact below, and every fact carries its source. With an LLM key
// (ANTHROPIC_API_KEY) the deterministic draft is rephrased by the model under "add no facts" instructions; without one
// the deterministic text is used as is (composer: "deterministic"). An LLM failure is reported, not hidden.
import { fmtTime, DISPLAY_TZ } from "@/lib/format";
import { describeFields } from "./screen";
import type { MemoryEvent } from "@/lib/memory/types";
import type { IntegrationInfo } from "@/lib/live/types";

export type GreetingSource = { label: string; ref: string };
export type Greeting = {
  status: "ok";
  text: string;
  composer: "deterministic" | "llm";
  llmError?: string;
  sources: GreetingSource[];
  facts: Record<string, unknown>;
  generatedAt: string;
};

type Memory = { status: "ok"; events: MemoryEvent[] } | { status: "unavailable" | "error"; reason: string };
type FieldSnap = { value: unknown; endpoint: string | null; path: string | null } | null;

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const istHour = (now: Date) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: DISPLAY_TZ }).format(now));
// conventional greeting boundaries (local IST hour), not data
const salutation = (now: Date) => (istHour(now) < 12 ? "Good morning" : istHour(now) < 17 ? "Good afternoon" : "Good evening");

export function composeGreeting(input: { name?: string | null; memory: Memory; connectors: IntegrationInfo[]; now?: Date }): Omit<Greeting, "composer" | "status" | "generatedAt"> {
  const now = input.now ?? new Date();
  const sources: GreetingSource[] = [];
  const facts: Record<string, unknown> = {};
  const parts: string[] = [`${salutation(now)}${input.name ? `, ${input.name}` : ""}.`];

  // 1 · what came in since the last greeting
  if (input.memory.status !== "ok") {
    parts.push(`I can't read the firm's memory right now: ${input.memory.reason}. So I can't tell you what happened since you were last here.`);
    sources.push({ label: "Organizational memory", ref: `GET /api/memory/events → ${input.memory.reason}` });
    facts.memory = input.memory.reason;
  } else {
    const ev = input.memory.events;
    const lastPlayed = [...ev].reverse().find((e) => e.kind === "greeting.played");
    const since = ev.filter((e) => (!lastPlayed || Number(e.id) > Number(lastPlayed.id)) && !e.kind.startsWith("greeting."));
    const researched = [...new Set(since.filter((e) => e.kind === "research.run" && e.subject).map((e) => e.subject!.label ?? e.subject!.id))];
    const notes = since.filter((e) => e.kind === "note.added");
    const access = since.filter((e) => e.kind === "access.requested");
    const sinceWhen = lastPlayed ? `since your last briefing at ${fmtTime(lastPlayed.at)}` : "so far";
    facts.window = { sinceEventId: lastPlayed?.id ?? null, events: since.length };
    if (!since.length) parts.push(lastPlayed ? `Nothing new came in ${sinceWhen}.` : "Nothing has come in yet: the firm's memory is empty.");
    else {
      const bits = [
        researched.length ? `${list(researched)} ${researched.length === 1 ? "was" : "were"} researched` : null,
        notes.length ? `${plural(notes.length, "note was", "notes were")} added` : null,
        access.length ? `${plural(access.length, "access request", "access requests")} came in` : null,
      ].filter((x): x is string => !!x);
      parts.push(`${sinceWhen[0]!.toUpperCase()}${sinceWhen.slice(1)}, ${plural(since.length, "thing happened", "things happened")}${bits.length ? `: ${list(bits)}.` : "."}`);
      const latestNote = notes.at(-1);
      if (latestNote) parts.push(`The latest note says: “${latestNote.summary}”.`);
    }
    sources.push({ label: "Organizational memory", ref: `GET /api/memory/events · ${since.length} events in window${lastPlayed ? ` after #${lastPlayed.id}` : ""}` });
  }

  // 2 · what needs attention
  const broken = input.connectors.filter((c) => c.status === "error");
  const inbound = input.connectors.filter((c) => (c.id === "gmail" || c.id === "calendar") && c.status !== "connected");
  if (broken.length) parts.push(`${list(broken.map((c) => c.name))} ${broken.length === 1 ? "needs" : "need"} your attention.`);
  if (inbound.length) parts.push(`${list(inbound.map((c) => c.name))} ${inbound.length === 1 ? "isn't" : "aren't"} connected, so I have no inbound email or meetings to brief you on.`);
  if (!broken.length && !inbound.length) parts.push("All connectors look healthy.");
  facts.connectors = input.connectors.map((c) => ({ id: c.id, status: c.status }));
  sources.push({ label: "Connector status", ref: `GET /api/integrations/connectors · ${input.connectors.map((c) => `${c.id}: ${c.status}`).join(", ")}` });

  // 3 · the top deal = the most recent company researched or opened
  if (input.memory.status === "ok") {
    const deal = [...input.memory.events].reverse().find((e) => (e.kind === "research.run" || e.kind === "deal.opened") && e.subject && (e.data as { status?: string } | null)?.status !== "no_match");
    if (!deal) parts.push("There's no deal on your desk yet. Research a company from the pipeline to start one.");
    else {
      const run = [...input.memory.events].reverse().find((e) => e.kind === "research.run" && e.subject?.id === deal.subject!.id && (e.data as { fields?: unknown } | null)?.fields);
      const f = ((run?.data as { fields?: Record<string, FieldSnap> } | undefined)?.fields ?? {}) as Record<string, FieldSnap>;
      const name = deal.subject!.label ?? deal.subject!.id;
      const said = describeFields(f);
      parts.push(`The latest deal on your desk is ${name}${said.length ? `: ${list(said)}` : ""}.`);
      facts.topDeal = { subject: deal.subject, eventId: deal.id, fields: f };
      sources.push({ label: `Top deal: ${name}`, ref: `memory event #${deal.id} (${deal.kind})${run ? ` · numbers from research.run #${run.id}` : ""}` });
      for (const [k, v] of Object.entries(f)) if (v?.endpoint) sources.push({ label: k, ref: `Crustdata ${v.endpoint} · ${v.path}` });
    }
  }
  return { text: parts.join(" "), sources, facts };
}

/** Rephrase with Claude (Anthropic Messages API) without adding facts. Throws on failure (caller reports it). */
export async function rephraseWithLlm(draft: string, facts: Record<string, unknown>, env: Record<string, string | undefined>, f: typeof fetch = fetch): Promise<string> {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const r = await f("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.DEALDESK_LLM_MODEL?.trim() || "claude-sonnet-5-5",
      max_tokens: 400,
      system: "You are the Deal Desk voice assistant speaking to a venture investor. Turn the factual draft into warm, natural speech, or answer the question in the facts if there is one. Use ONLY the facts given; never add companies, numbers, events or dates; if the facts do not answer the question, say so. Keep every number exactly. Plain text, no markdown, under 90 words.",
      messages: [{ role: "user", content: `Facts (JSON): ${JSON.stringify(facts)}\n\nDraft: ${draft}\n\nWrite what to say.` }],
    }),
  });
  const j = (await r.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
  if (!r.ok) throw new Error(`Anthropic /v1/messages → ${r.status}${j?.error?.message ? `: ${j.error.message}` : ""}`);
  const text = j?.content?.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  if (!text) throw new Error("Anthropic returned no text");
  return text;
}
