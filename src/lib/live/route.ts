import "server-only";
import { NextResponse } from "next/server";
import type { CrustdataClient } from "@/lib/crustdata";
import { withDeadline } from "@/lib/resilience/deadline";
import { parseCompanyId } from "./resolve";
import { badRequest, failureFrom, failureResponse, liveCrustdataClient } from "./server";

/**
 * Wraps a /api/live/* handler: client construction (not-connected → 503), error mapping (→ 502).
 * `parse` validates query params and returns either the parsed input or a 400 message (+ optional `suggestion`).
 * `deadlineMs` bounds every Crustdata call (incl. retries/backoff) made by `run`; keep it under the route's maxDuration.
 */
export function liveRoute<I>(
  parse: (q: URLSearchParams) => { ok: true; input: I } | { ok: false; message: string; suggestion?: string },
  run: (client: CrustdataClient, input: I) => Promise<unknown>,
  { deadlineMs = 40_000 }: { deadlineMs?: number } = {},
) {
  return async function GET(req: Request) {
    const parsed = parse(new URL(req.url).searchParams);
    if (!parsed.ok) return badRequest(parsed.message, parsed.suggestion);
    try {
      const client = liveCrustdataClient();
      return NextResponse.json(await withDeadline(deadlineMs, () => run(client, parsed.input)), { headers: { "cache-control": "no-store" } });
    } catch (e) {
      const f = failureFrom(e);
      console.error(`[live] ${new URL(req.url).pathname} failed: ${f.message}`);
      return failureResponse(f);
    }
  };
}

export const companyIdParam = (q: URLSearchParams) => {
  const id = parseCompanyId(q.get("companyId"));
  return id ? ({ ok: true, input: id } as const) : ({ ok: false, message: "companyId must be a positive integer (crustdata_company_id)" } as const);
};
