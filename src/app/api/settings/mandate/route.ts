// GET/PUT /api/settings/mandate — the firm mandate and priors used to score deals (src/lib/settings/mandate.ts).
import { NextResponse } from "next/server";
import { mandateStore, parseMandate, unsetMandateFields } from "@/lib/settings/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mandate = mandateStore().get();
  return NextResponse.json({ mandate, unset: unsetMandateFields(mandate) });
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
  const mandate = mandateStore().set(parsed.mandate);
  return NextResponse.json({ mandate, unset: unsetMandateFields(mandate) });
}
