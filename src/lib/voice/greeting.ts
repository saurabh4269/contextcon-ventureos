// The Today voice greeting, composed from REAL data only:
//   - organizational memory (what happened since the last played greeting; the latest deal researched/opened),
//   - connector status (what needs attention; whether inbound sources are connected at all).
// Nothing is canned: every clause comes from a fact below, and every fact carries its source. With an LLM key
// (OPENAI_API_KEY or ANTHROPIC_API_KEY) the deterministic draft is rephrased by the model under "add no facts" instructions; without one
// the deterministic text is used as is (composer: "deterministic"). An LLM failure is reported, not hidden.
import { DEFAULT_OPENAI_FAST_MODEL, modelFromEnv, openaiModel } from "@/lib/agent/model";
import { fmtDate, fmtTime, DISPLAY_TZ } from "@/lib/format";
import type { InboxThread } from "@/lib/google/gmail";
import type { Meeting } from "@/lib/google/calendar";
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

/** The client's IANA time zone if valid, else DISPLAY_TZ (Asia/Kolkata). */
export function resolveTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return DISPLAY_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DISPLAY_TZ; }
}
/** A client-reported local hour if it is an integer 0..23, else null. */
export function parseHour(h: unknown): number | null {
  const n = typeof h === "number" ? h : typeof h === "string" && /^\d{1,2}$/.test(h.trim()) ? Number(h) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
}
export const hourIn = (now: Date, tz: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(now));
// conventional greeting boundaries (the user's local hour), not data
export const salutation = (hour: number) => (hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 22 ? "Good evening" : "Working late");
/** An opening salutation (with an optional name), e.g. "Good morning, Saurabh." / "Hi there!" */
const SALUTATION_RE = /^\s*(?:[Gg]ood\s+(?:morning|afternoon|evening|night|day)|[Ww]orking late|[Hh]ello|[Hh]i|[Hh]ey)\b(?:\s+there)?(?:,?\s*[A-Z][\w'-]*(?=[.!,]))?\s*[.!,]?\s*/;
/** Drop a leading salutation (non-Today screens start directly with their content, even if a model adds one). */
export function stripSalutation(text: string): string {
  const out = text.replace(SALUTATION_RE, "");
  return out ? out[0]!.toUpperCase() + out.slice(1) : text;
}

type Feed<T> = { status: "ok"; items: T[]; since?: string | null } | { status: "unavailable" | "error"; reason: string };

/** `tz` / `hour` come from the client (validated by the caller or here); the client's hour wins, then its time zone, then IST. */
export function composeGreeting(input: { name?: string | null; memory: Memory; connectors: IntegrationInfo[]; inbox?: Feed<InboxThread>; meetings?: Feed<Meeting>; now?: Date; tz?: string | null; hour?: number | null }): Omit<Greeting, "composer" | "status" | "generatedAt"> {
  const now = input.now ?? new Date();
  const sources: GreetingSource[] = [];
  const tz = resolveTimeZone(input.tz);
  const hour = parseHour(input.hour) ?? hourIn(now, tz);
  const opening = `${salutation(hour)}${input.name ? `, ${input.name}` : ""}.`;
  const facts: Record<string, unknown> = { salutation: opening, localHour: hour, timeZone: tz };
  const parts: string[] = [opening];

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

  // 2 · inbound email and the next meeting (Gmail / Calendar), when connected
  const inbox = input.inbox, meet = input.meetings;
  if (inbox?.status === "ok") {
    const t = inbox.items, unread = t.filter((x) => x.unread).length;
    const when = inbox.since ? `since ${fmtTime(inbox.since)}` : "in your inbox lately";
    const senders = [...new Set(t.map((x) => x.from))].slice(0, 3);
    parts.push(t.length ? `${plural(t.length, "email thread", "email threads")} came in ${when}${unread ? `, ${unread} unread` : ""}, from ${list(senders)}${t.length > senders.length ? " and others" : ""}.` : `No new email ${inbox.since ? `since ${fmtTime(inbox.since)}` : "in your inbox"}.`);
    facts.inbox = { since: inbox.since ?? null, threads: t.length, unread, senders };
    sources.push({ label: "Gmail", ref: `GET /api/connectors/gmail/threads · ${t.length} threads${inbox.since ? ` after ${inbox.since}` : ""}` });
  } else if (inbox) { parts.push(`I couldn't read your inbox: ${inbox.reason}`); sources.push({ label: "Gmail", ref: inbox.reason }); }
  if (meet?.status === "ok") {
    const next = meet.items[0];
    const today = fmtDate(now.toISOString());
    parts.push(next ? `Your next meeting is ${next.summary}${next.allDay ? ` on ${fmtDate(next.start)}` : ` at ${fmtTime(next.start)}${fmtDate(next.start) !== today ? ` on ${fmtDate(next.start)}` : ""}`}.` : "Nothing is on your calendar ahead.");
    facts.nextMeeting = next ? { summary: next.summary, start: next.start } : null;
    sources.push({ label: "Google Calendar", ref: `GET /api/connectors/calendar/events · ${meet.items.length} upcoming` });
  } else if (meet) { parts.push(`I couldn't read your calendar: ${meet.reason}`); sources.push({ label: "Google Calendar", ref: meet.reason }); }

  // 3 · what needs attention
  const broken = input.connectors.filter((c) => c.status === "error");
  const inbound = input.connectors.filter((c) => (c.id === "gmail" || c.id === "calendar") && c.status === "not_configured");
  if (broken.length) parts.push(`${list(broken.map((c) => c.name))} ${broken.length === 1 ? "needs" : "need"} your attention.`);
  if (inbound.length) parts.push(`${list(inbound.map((c) => c.name))} ${inbound.length === 1 ? "isn't" : "aren't"} connected, so I have no ${inbound.length === 2 ? "inbound email or meetings" : inbound[0]!.id === "gmail" ? "inbound email" : "meetings"} to brief you on.`);
  if (!broken.length && !inbound.length) parts.push("All connectors look healthy.");
  facts.connectors = input.connectors.map((c) => ({ id: c.id, status: c.status }));
  sources.push({ label: "Connector status", ref: `GET /api/integrations/connectors · ${input.connectors.map((c) => `${c.id}: ${c.status}`).join(", ")}` });

  // 4 · the top deal = the most recent company researched or opened
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

/** Rephrase with the configured model (Anthropic, else OpenAI: same selection as the research agent) without adding facts. Throws on failure (caller reports it). */
export async function rephraseWithLlm(draft: string, facts: Record<string, unknown>, env: Record<string, string | undefined>, f: typeof fetch = fetch, opts: { greet?: boolean } = {}): Promise<string> {
  // OpenAI path uses the light model with low reasoning: this is phrasing, spoken within seconds
  const oa = env.OPENAI_API_KEY?.trim();
  const model = !env.ANTHROPIC_API_KEY?.trim() && oa ? openaiModel(oa, env.OPENAI_FAST_MODEL?.trim() || DEFAULT_OPENAI_FAST_MODEL, f, { reasoningEffort: "low" }) : modelFromEnv(env, f);
  if (!model) throw new Error("no AI model key set (OPENAI_API_KEY or ANTHROPIC_API_KEY)");
  const turn = await model.complete({
    system: "You are the Deal Desk voice assistant speaking to a venture investor. Turn the factual draft into warm, natural speech, or answer the question in the facts if there is one. Use ONLY the facts given; never add companies, numbers, events or dates; if the facts do not answer the question, say so. Keep every number exactly. Plain text, no markdown, under 90 words. "
      + (opts.greet ? "Open with the salutation in the facts exactly as written; never use a different time of day." : "Do not greet: no salutation (good morning/afternoon/evening, hello), no name; start directly with the content."),
    messages: [{ role: "user", text: `Facts (JSON): ${JSON.stringify(facts)}\n\nDraft: ${draft}\n\nWrite what to say.` }],
    tools: [],
    maxTokens: 4000,
  });
  if (!turn.text) throw new Error(`${model.provider} returned no text`);
  return turn.text;
}
