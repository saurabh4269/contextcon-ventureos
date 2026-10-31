// Context-aware spoken lines for every screen except /today (which gets the full greeting, ./greeting.ts).
// Built only from real data: organizational memory (events about the screen's subject) and connector status, plus the
// screen's own honest availability (src/live/sources.ts). If nothing is known, the line says so.
import { fmtLabel, fmtMoney, fmtTime, isMoney } from "@/lib/format";
import type { MemoryEvent } from "@/lib/memory/types";
import type { IntegrationInfo } from "@/lib/live/types";
import { SOURCES, type ScreenId } from "@/live/sources";
import type { GreetingSource } from "./greeting";

export type ScreenContext = { screen: string; subject?: string | null };
type Memory = { status: "ok"; events: MemoryEvent[] } | { status: "unavailable" | "error"; reason: string };
type FieldSnap = { value: unknown; endpoint: string | null; path: string | null } | null;

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function describeFields(f: Record<string, FieldSnap>): string[] {
  return [
    f.headcountLatest ? `${f.headcountLatest.value} people` : null,
    f.growthYoY && typeof f.growthYoY.value === "number" ? `headcount ${f.growthYoY.value >= 0 ? "up" : "down"} ${Math.abs(Math.round(f.growthYoY.value))} percent year over year` : null,
    f.lastRoundType ? `last round a ${fmtLabel(f.lastRoundType.value)}${f.lastFunding && isMoney(f.lastFunding.value) ? ` of ${fmtMoney(f.lastFunding.value)}` : ""}` : null,
  ].filter((x): x is string => !!x);
}

export function composeScreenLine(ctx: ScreenContext, memory: Memory, connectors: IntegrationInfo[]): { text: string; sources: GreetingSource[]; facts: Record<string, unknown> } {
  const sources: GreetingSource[] = [];
  const facts: Record<string, unknown> = { screen: ctx.screen, subject: ctx.subject ?? null };
  const mem = memory.status === "ok" ? memory.events : null;
  const memNote = memory.status === "ok" ? null : `I can't read the firm's memory: ${memory.reason}.`;
  if (memory.status !== "ok") sources.push({ label: "Organizational memory", ref: `GET /api/memory/events → ${memory.reason}` });

  // a company (deal or memo page)
  if ((ctx.screen === "deal" || ctx.screen === "memo") && ctx.subject) {
    const id = ctx.subject;
    if (!mem) return { text: `${memNote} So I have nothing recorded on ${id} beyond what's on screen.`, sources, facts };
    const about = mem.filter((e) => e.subject?.id === id);
    const run = [...about].reverse().find((e) => e.kind === "research.run" && (e.data as { fields?: unknown } | null)?.fields);
    const notes = about.filter((e) => e.kind === "note.added");
    const name = about.at(-1)?.subject?.label ?? id;
    if (!about.length) return { text: `I have nothing recorded on ${id} yet. Once it's researched, I'll keep track of what changes.`, sources: [{ label: "Organizational memory", ref: `no events with subject ${id}` }], facts };
    const fields = ((run?.data as { fields?: Record<string, FieldSnap> } | undefined)?.fields ?? {}) as Record<string, FieldSnap>;
    const said = describeFields(fields);
    const runs = about.filter((e) => e.kind === "research.run");
    const parts = [
      `Here's what I have on ${name}.`,
      said.length ? `As of the last research run at ${fmtTime(run!.at)}: ${list(said)}.` : "No research numbers are recorded for it yet.",
      runs.length > 1 ? `It's been researched ${plural(runs.length, "time", "times")}.` : null,
      notes.length ? `${plural(notes.length, "note", "notes")} on file; the latest says: “${notes.at(-1)!.summary}”.` : "There are no notes on it yet.",
      ctx.screen === "memo" ? "There's no IC memo drafted for it in this build." : null,
    ].filter(Boolean) as string[];
    sources.push({ label: `Memory on ${name}`, ref: `${about.length} events with subject ${id}${run ? ` · numbers from research.run #${run.id}` : ""}` });
    for (const [k, v] of Object.entries(fields)) if (v?.endpoint) sources.push({ label: k, ref: `Crustdata ${v.endpoint} · ${v.path}` });
    facts.fields = fields;
    facts.notes = notes.map((n) => n.summary);
    return { text: parts.join(" "), sources, facts };
  }

  // a person
  if (ctx.screen === "person" && ctx.subject) {
    if (!mem) return { text: `${memNote}`, sources, facts };
    const about = mem.filter((e) => e.subject?.id === ctx.subject);
    const name = about.find((e) => e.subject?.label)?.subject?.label;
    sources.push({ label: "Organizational memory", ref: `${about.length} events with subject ${ctx.subject}` });
    if (!about.length) return { text: "I have nothing recorded on this person yet beyond their Crustdata profile on screen.", sources, facts };
    const notes = about.filter((e) => e.kind === "note.added");
    return { text: `You've looked at ${name ?? "this person"} ${plural(about.filter((e) => e.kind !== "note.added").length, "time", "times")}${notes.length ? `, and the latest note says: “${notes.at(-1)!.summary}”` : ", with no notes yet"}.`, sources, facts };
  }

  // connectors
  if (ctx.screen === "settings") {
    const by = (s: IntegrationInfo["status"]) => connectors.filter((c) => c.status === s).map((c) => c.name);
    const [ok, err, off] = [by("connected"), by("error"), by("not_configured")];
    sources.push({ label: "Connector status", ref: `GET /api/integrations/connectors · ${connectors.map((c) => `${c.id}: ${c.status}`).join(", ")}` });
    facts.connectors = connectors.map((c) => ({ id: c.id, status: c.status }));
    return {
      text: [ok.length ? `${list(ok)} ${ok.length === 1 ? "is" : "are"} connected.` : "Nothing is connected yet.", err.length ? `${list(err)} ${err.length === 1 ? "needs" : "need"} attention.` : null, off.length ? `${plural(off.length, "connector isn't", "connectors aren't")} configured: ${list(off)}.` : null].filter(Boolean).join(" "),
      sources,
      facts,
    };
  }

  // screens without a live source: say so, plus what memory does know
  const src = SOURCES[ctx.screen as ScreenId];
  const head = src ? `${src.label}: ${src.title.toLowerCase()} in this build.` : "I don't have live data for this screen.";
  if (!mem) return { text: `${head} ${memNote}`, sources, facts };
  const researched = [...new Set(mem.filter((e) => e.kind === "research.run" && e.subject).map((e) => e.subject!.label ?? e.subject!.id))];
  sources.push({ label: "Organizational memory", ref: `GET /api/memory/events · ${mem.length} recent events` });
  const tail = ctx.screen === "brain" || ctx.screen === "today"
    ? mem.length ? `Memory holds ${plural(mem.length, "recent event", "recent events")}; the latest: ${mem.at(-1)!.summary}.` : "Memory is empty so far."
    : researched.length ? `So far you've researched ${list(researched.slice(-3))}.` : "Nothing has been researched yet.";
  return { text: `${head} ${tail}`, sources, facts: { ...facts, researched } };
}
