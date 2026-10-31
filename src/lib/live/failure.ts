import { CrustdataApiError } from "@/lib/crustdata/http";
import { CrustdataConfigError } from "@/lib/crustdata/mode";
import type { LiveFailure } from "./types";

export class NotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConnectedError";
  }
}

/** Map a thrown error to the API failure body. Only a missing key is "not_connected"; everything else is "error". */
export function failureFrom(e: unknown): LiveFailure {
  if (e instanceof NotConnectedError || e instanceof CrustdataConfigError) return { status: "not_connected", message: e.message };
  if (e instanceof CrustdataApiError) {
    if (e.status === 401 || e.status === 403) {
      return { status: "error", upstreamStatus: e.status, message: `Crustdata rejected the request (${e.status}): ${e.message}` };
    }
    return { status: "error", upstreamStatus: e.status, message: e.message };
  }
  return { status: "error", message: e instanceof Error ? e.message : String(e) };
}
