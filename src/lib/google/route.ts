import "server-only";
import { NextResponse } from "next/server";
import { GoogleApiError, googleConfig, type GoogleConfig } from "./oauth";

export const NO_STORE = { "cache-control": "no-store" };

/** Run a Google call for a route: 503 not_connected without env, typed 401/403/502 errors otherwise. */
export async function withGoogle(run: (cfg: GoogleConfig) => Promise<Response>): Promise<Response> {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.json({ status: "not_connected", message: "Google is not connected: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then sign in from Settings › Connectors (or set GOOGLE_REFRESH_TOKEN)." }, { status: 503, headers: NO_STORE });
  try {
    return await run(cfg);
  } catch (e) {
    if (e instanceof GoogleApiError) {
      const status = e.code === "expired" ? 401 : e.code === "forbidden" ? 403 : 502;
      return NextResponse.json({ status: "error", code: e.code, upstreamStatus: e.httpStatus ?? null, message: e.message }, { status, headers: NO_STORE });
    }
    return NextResponse.json({ status: "error", message: e instanceof Error ? e.message : String(e) }, { status: 502, headers: NO_STORE });
  }
}
