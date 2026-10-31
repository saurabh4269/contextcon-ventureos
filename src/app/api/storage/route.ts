// GET /api/storage → where server state is kept (review queue, deal stages, workflows, mandate, memory without a
// database): { kind, durable, label, note, env }. Names env vars only; never a URL or a secret.
import { NextResponse } from "next/server";
import { DATABASE_ENV, databaseUrl, storageInfo } from "@/lib/store/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = databaseUrl();
  return NextResponse.json({ ...storageInfo(), env: { database: db ? db.name : null, accepted: DATABASE_ENV } }, { headers: { "cache-control": "no-store" } });
}
