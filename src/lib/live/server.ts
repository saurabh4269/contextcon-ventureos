import "server-only";
import { NextResponse } from "next/server";
import { createCrustdataClient, defaultResponseCache, type CrustdataClient } from "@/lib/crustdata";
import { failureFrom, NotConnectedError } from "./failure";
import type { LiveFailure } from "./types";

export { failureFrom, NotConnectedError };

const g = globalThis as unknown as { __dealdeskCrustdata?: { key: string; client: CrustdataClient } };

/**
 * The process-wide live Crustdata client (one rate limiter + response cache per process).
 * Throws NotConnectedError without a key. There is no fixture mode: every response is a real Crustdata response.
 */
export function liveCrustdataClient(): CrustdataClient {
  const key = process.env.CRUSTDATA_API_KEY?.trim();
  if (!key) throw new NotConnectedError("Crustdata is not connected: CRUSTDATA_API_KEY is not set on the server.");
  if (g.__dealdeskCrustdata?.key === key) return g.__dealdeskCrustdata.client;
  const client = createCrustdataClient({
    apiKey: key,
    cache: defaultResponseCache(),
    // One line per billed network call (cache hits are silent). Never includes the key or the response body.
    onLiveCall: (e) =>
      console.info(`[crustdata] ${e.method} ${e.path} ${e.status} credits=${e.creditsUsed ?? "?"} ${e.latencyMs}ms${e.error ? ` ${e.error}` : ""}`),
  });
  g.__dealdeskCrustdata = { key, client };
  return client;
}

/** HTTP status for a failure body: 503 not connected, 502 upstream error. */
export function failureResponse(f: LiveFailure) {
  return NextResponse.json(f, { status: f.status === "not_connected" ? 503 : 502 });
}

/** 400 body; `suggestion` (e.g. "strpe.com" for "strpe..com") is offered, never applied. */
export function badRequest(message: string, suggestion?: string) {
  return NextResponse.json({ status: "error", message, ...(suggestion ? { suggestion } : {}) }, { status: 400 });
}
