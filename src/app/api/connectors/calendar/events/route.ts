// GET  /api/connectors/calendar/events?max=<1..25> → { status:"ok", events: Meeting[] } (primary calendar, from now)
// POST /api/connectors/calendar/events {summary, start, end, description?, attendees?} → 201 { status:"ok", event }
//      (book-call flow; sendUpdates=none, so Google sends no invitations). Appends "meeting.booked" to memory.
import { NextResponse } from "next/server";
import { insertEvent, listUpcoming } from "@/lib/google/calendar";
import { NO_STORE, withGoogle } from "@/lib/google/route";
import { recordMemory } from "@/lib/memory/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DEFAULT_MAX = 5, MAX = 25, MAX_SUMMARY = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("max");
  const max = raw ? Number(raw) : DEFAULT_MAX;
  if (!Number.isInteger(max) || max < 1 || max > MAX) return NextResponse.json({ status: "error", message: `max must be 1..${MAX}` }, { status: 400 });
  return withGoogle(async (cfg) => NextResponse.json({ status: "ok", events: await listUpcoming(cfg, { from: new Date(), max }) }, { headers: NO_STORE }));
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { summary?: unknown; start?: unknown; end?: unknown; description?: unknown; attendees?: unknown } | null;
  const bad = (message: string) => NextResponse.json({ status: "error", message }, { status: 400 });
  if (!b || typeof b.summary !== "string" || !b.summary.trim() || b.summary.length > MAX_SUMMARY) return bad(`summary is required (≤ ${MAX_SUMMARY} chars)`);
  if (typeof b.start !== "string" || typeof b.end !== "string" || Number.isNaN(Date.parse(b.start)) || Number.isNaN(Date.parse(b.end))) return bad("start and end must be ISO timestamps");
  if (Date.parse(b.end) <= Date.parse(b.start)) return bad("end must be after start");
  const attendees = Array.isArray(b.attendees) ? b.attendees : [];
  if (!attendees.every((a) => typeof a === "string" && EMAIL.test(a))) return bad("attendees must be email addresses");
  return withGoogle(async (cfg) => {
    const event = await insertEvent(cfg, { summary: b.summary as string, start: new Date(b.start as string).toISOString(), end: new Date(b.end as string).toISOString(), description: typeof b.description === "string" ? b.description : undefined, attendees: attendees as string[] });
    await recordMemory({ kind: "meeting.booked", actor: { type: "user" }, subject: { type: "event", id: event.id, label: event.summary }, summary: `Booked “${event.summary}”`, data: { start: event.start, end: event.end, attendees: event.attendees }, source: "api:/api/connectors/calendar/events" });
    return NextResponse.json({ status: "ok", event }, { status: 201, headers: NO_STORE });
  });
}
