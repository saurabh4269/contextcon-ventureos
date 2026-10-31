// Opt-in outage drill for demos and operators: DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1 makes every Crustdata request
// answer 503 without leaving the server, so the graceful-degradation path (retries → circuit breaker → last good
// cached response labelled "cached at … IST", or an honest error) can be shown on real data. Off by default; it never
// produces data, only failures, and every failure names the switch.
export const SIMULATE_OUTAGE_ENV = "DEALDESK_SIMULATE_CRUSTDATA_OUTAGE";

export function simulatedOutage(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SIMULATE_OUTAGE_ENV]?.trim() === "1";
}

export const simulatedOutageFetch = (async () =>
  new Response(JSON.stringify({ error: { type: "internal_error", message: `Simulated Crustdata outage (${SIMULATE_OUTAGE_ENV}=1); no request was sent` } }), {
    status: 503,
    headers: { "content-type": "application/json" },
  })) as unknown as typeof fetch;
