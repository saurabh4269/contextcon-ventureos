import { CrustdataApiError, CrustdataMalformedResponseError, CrustdataTransportError, RETRYABLE_STATUS } from "@/lib/crustdata/http";
import { fmtTime } from "@/lib/format";
import { CircuitOpenError } from "@/lib/resilience/breaker";
import { CrustdataConfigError } from "@/lib/crustdata/mode";
import type { LiveFailure } from "./types";

export class NotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConnectedError";
  }
}

/**
 * Map a thrown error to the API failure body. Only a missing key is "not_connected"; everything else is "error", with
 * an honest message (what failed, whether it was retried, when to retry in IST). Nothing is ever reported as no-match.
 */
export function failureFrom(e: unknown): LiveFailure {
  if (e instanceof NotConnectedError || e instanceof CrustdataConfigError) return { status: "not_connected", message: e.message };
  if (e instanceof CircuitOpenError) {
    return { status: "error", retryable: true, message: `${e.key} is unavailable after repeated failures; calls are paused until ${fmtTime(new Date(e.retryAt).toISOString())}. No data was invented.` };
  }
  if (e instanceof CrustdataTransportError) return { status: "error", retryable: true, message: `${e.message} (retried where safe). No data was invented.` };
  if (e instanceof CrustdataMalformedResponseError) return { status: "error", retryable: true, upstreamStatus: e.status, message: e.message };
  if (e instanceof CrustdataApiError) {
    if (e.status === 401 || e.status === 403) {
      return { status: "error", upstreamStatus: e.status, message: `Crustdata rejected the request (${e.status}): ${e.message}` };
    }
    if (e.status === 429) {
      return { status: "error", retryable: true, upstreamStatus: 429, message: `${e.message} (rate limited${e.retryAfterSeconds != null ? `; retry in ${e.retryAfterSeconds} s` : ""})` };
    }
    if (RETRYABLE_STATUS.has(e.status)) return { status: "error", retryable: true, upstreamStatus: e.status, message: `${e.message} (Crustdata is having trouble; retried before giving up)` };
    return { status: "error", upstreamStatus: e.status, message: e.message };
  }
  return { status: "error", message: e instanceof Error ? e.message : String(e) };
}
