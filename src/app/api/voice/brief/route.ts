// What the voice assistant says (see src/lib/voice/brief.ts). Response: { status:"ok", text, composer, llmError?, sources, facts, generatedAt }
//   GET  /api/voice/brief?screen=today                 → the Today greeting
//   GET  /api/voice/brief?screen=deal&subject=e2b.dev  → a context line for the current screen
//   POST /api/voice/brief {screen, subject?, question} → a reply to a spoken/typed question
// Optional on both: tz (the client's IANA time zone) and hour (its local hour, 0-23). Invalid values fall back to
// Asia/Kolkata; only the Today greeting uses them (salutation). Never cached: greetings depend on the time of day.
import { NextResponse } from "next/server";
import { buildBrief } from "@/lib/voice/brief";
import { parseHour, resolveTimeZone } from "@/lib/voice/greeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SCREEN = /^[a-z]{2,20}$/;
const MAX_Q = 500;
const NO_STORE = { "cache-control": "no-store, no-cache, max-age=0, must-revalidate" };
const bad = (message: string) => NextResponse.json({ status: "error", message }, { status: 400, headers: NO_STORE });
const clock = (tz: unknown, hour: unknown) => ({ tz: resolveTimeZone(tz), hour: parseHour(hour) });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const screen = q.get("screen") ?? "";
  if (!SCREEN.test(screen)) return bad("screen must be a screen id, e.g. today, deal, settings");
  return NextResponse.json(await buildBrief({ screen, subject: q.get("subject")?.slice(0, 300) || null, ...clock(q.get("tz"), q.get("hour")) }), { headers: NO_STORE });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { screen?: unknown; subject?: unknown; question?: unknown; tz?: unknown; hour?: unknown } | null;
  if (!b || typeof b.screen !== "string" || !SCREEN.test(b.screen)) return bad("screen must be a screen id");
  if (typeof b.question !== "string" || !b.question.trim() || b.question.length > MAX_Q) return bad(`question must be 1..${MAX_Q} characters`);
  const subject = typeof b.subject === "string" ? b.subject.slice(0, 300) : null;
  return NextResponse.json(await buildBrief({ screen: b.screen, subject, question: b.question.trim(), ...clock(b.tz, b.hour) }), { headers: NO_STORE });
}
