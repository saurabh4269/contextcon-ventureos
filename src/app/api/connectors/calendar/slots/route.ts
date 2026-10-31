// GET /api/connectors/calendar/slots?minutes=30&count=3&days=5 → { status:"ok", slots:[{start,end}], busyCount, window }
// Free slots on the connected primary calendar (freeBusy), working hours 10:00–19:00 IST, Mon–Fri. Read only.
import { NextResponse } from "next/server";
import { busyIntervals, freeSlots, workingHoursLabel } from "@/lib/google/calendar";
import { NO_STORE, withGoogle } from "@/lib/google/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const num = (k: string, d: number, lo: number, hi: number) => { const v = q.get(k) == null ? d : Number(q.get(k)); return Number.isInteger(v) && v >= lo && v <= hi ? v : null; };
  const minutes = num("minutes", 30, 15, 120), count = num("count", 3, 1, 10), days = num("days", 5, 1, 14);
  if (minutes == null || count == null || days == null) return NextResponse.json({ status: "error", message: "minutes 15..120, count 1..10, days 1..14 (integers)" }, { status: 400, headers: NO_STORE });
  return withGoogle(async (cfg) => {
    const now = new Date(), to = new Date(now.getTime() + days * 86_400_000);
    const busy = await busyIntervals(cfg, now, to);
    return NextResponse.json({ status: "ok", slots: freeSlots(busy, { now, minutes, count, days }), busyCount: busy.length, window: { from: now.toISOString(), to: to.toISOString(), hours: workingHoursLabel() } }, { headers: NO_STORE });
  });
}
