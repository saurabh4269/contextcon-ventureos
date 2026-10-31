// DELETE /api/connectors/calendar/events/:id → 204 deleted · 410 already gone (sendUpdates=none).
import { NextResponse } from "next/server";
import { deleteEvent } from "@/lib/google/calendar";
import { NO_STORE, withGoogle } from "@/lib/google/route";
import { recordMemory } from "@/lib/memory/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  if (!/^[a-zA-Z0-9_-]{1,1024}$/.test(id)) return NextResponse.json({ status: "error", message: "invalid event id" }, { status: 400, headers: NO_STORE });
  return withGoogle(async (cfg) => {
    const status = await deleteEvent(cfg, id);
    if (status === 404) return NextResponse.json({ status: "error", code: "not_found", message: "No calendar event with that id" }, { status: 404, headers: NO_STORE });
    await recordMemory({ kind: "meeting.deleted", actor: { type: "user" }, subject: { type: "event", id }, summary: status === 204 ? "Deleted a calendar event" : "Calendar event was already gone", data: { upstreamStatus: status }, source: "api:/api/connectors/calendar/events/:id" });
    return new NextResponse(null, { status, headers: NO_STORE });
  });
}
