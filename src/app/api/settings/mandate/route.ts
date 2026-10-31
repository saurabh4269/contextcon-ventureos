// GET/PUT /api/settings/mandate — the firm mandate and priors used to score deals (src/lib/settings/mandate.ts).
// GET → { mandate, unset, source }; source says where it comes from (Settings, MANDATE_JSON, unset) and the storage.
// PUT → 409 when this deploy has no durable store and MANDATE_JSON pins the mandate.
import { NextResponse } from "next/server";
import { mandateStore, parseMandate, unsetMandateFields } from "@/lib/settings/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const { mandate, source } = await mandateStore().source();
  return NextResponse.json({ mandate, unset: unsetMandateFields(mandate), source }, { headers: NO_STORE });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "body must be JSON" }, { status: 400 });
  }
  const parsed = parseMandate(body);
  if (!parsed.ok) return NextResponse.json({ status: "error", message: parsed.message }, { status: 400 });
  const r = await mandateStore().set(parsed.mandate);
  if (!r.ok) return NextResponse.json({ status: "error", message: r.message }, { status: r.status });
  return NextResponse.json({ mandate: r.mandate, unset: unsetMandateFields(r.mandate), source: r.source }, { headers: NO_STORE });
}
