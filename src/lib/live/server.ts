import "server-only";
import { NextResponse } from "next/server";
import { createCrustdataClient, defaultResponseCache, type CrustdataClient } from "@/lib/crustdata";
import { failureFrom, NotConnectedError } from "./failure";
import { resolveDataMode } from "@/lib/datamode";
import type { LiveFailure } from "./types";

export { failureFrom, NotConnectedError };

const g = globalThis as unknown as { __dealdeskCrustdata?: { key: string; client: CrustdataClient } };

/**
 * The process-wide live Crustdata client (one rate limiter + response cache per process).
 * Throws NotConnectedError without a key, and refuses fixture-forcing env vars: live mode never serves fixtures.
 */
export function liveCrustdataClient(): CrustdataClient {
  const key = process.env.CRUSTDATA_API_KEY?.trim();
  if (!key) throw new NotConnectedError("Crustdata is not connected: CRUSTDATA_API_KEY is not set on the server.");
  for (const v of ["CRUSTDATA_FORCE_FIXTURE", "DEALDESK_FORCE_FIXTURE"]) {
    if (process.env[v] === "1") throw new Error(`${v}=1 conflicts with live data: unset it or use DEALDESK_DATA_MODE=demo.`);
  }
  if (g.__dealdeskCrustdata?.key === key) return g.__dealdeskCrustdata.client;
  const client = createCrustdataClient({
    apiKey: key,
    cache: defaultResponseCache(),
    // One line per billed network call (cache hits are silent). Never includes the key or the response body.
    onLiveCall: (e) =>
      console.info(`[crustdata] ${e.method} ${e.path} ${e.status} credits=${e.creditsUsed ?? "?"} ${e.latencyMs}ms${e.error ? ` ${e.error}` : ""}`),
  });
  if (client.mode !== "live") throw new Error("Crustdata client resolved to fixture mode in live data mode.");
  g.__dealdeskCrustdata = { key, client };
  return client;
}

/** HTTP status for a failure body: 503 not connected, 409 disabled (demo mode), 502 upstream error. */
export function failureResponse(f: LiveFailure) {
  return NextResponse.json(f, { status: f.status === "not_connected" ? 503 : f.status === "disabled" ? 409 : 502 });
}

/** /api/live/* only run in DEALDESK_DATA_MODE=live, so a public demo deployment can never spend credits. */
export function liveModeGuard(): LiveFailure | null {
  const mode = resolveDataMode();
  return mode === "live" ? null : { status: "disabled", message: "Live data is off (DEALDESK_DATA_MODE=demo). Set DEALDESK_DATA_MODE=live to call Crustdata." };
}

export function badRequest(message: string) {
  return NextResponse.json({ status: "error", message }, { status: 400 });
}
