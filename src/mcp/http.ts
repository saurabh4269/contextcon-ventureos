// Thin HTTP client for the Deal Desk server (the Next.js app). The MCP server and the `dealdesk` CLI hold no business
// logic: every tool calls an existing route (docs/API.md) and passes its answer through with its sources.
// Base URL: DEALDESK_URL (default http://localhost:3240, i.e. `npm run dev`). Keys stay in the app's own env.

export type Fetch = typeof fetch;
export type HttpResult = { ok: boolean; status: number; body: unknown };

export const baseUrl = (env: Record<string, string | undefined> = process.env) => (env.DEALDESK_URL?.trim() || "http://localhost:3240").replace(/\/+$/, "");

export class DealDeskHttp {
  constructor(readonly base: string = baseUrl(), private readonly f: Fetch = fetch, private readonly timeoutMs = 120_000) {}

  url(path: string) { return `${this.base}${path}`; }

  async json(method: "GET" | "POST", path: string, body?: unknown): Promise<HttpResult> {
    const r = await this.raw(method, path, body);
    if (!r.res) return { ok: false, status: 0, body: { status: "unreachable", message: `Deal Desk server unreachable at ${this.base} (${r.error}); start it with npm run dev or set DEALDESK_URL` } };
    const text = await r.res.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { ok: r.res.ok, status: r.res.status, body: parsed };
  }

  /** NDJSON stream routes (/api/live/screen, /api/sourcing/run): returns every event, in order. */
  async ndjson(path: string, body: unknown, onEvent?: (e: Record<string, unknown>) => void): Promise<{ ok: boolean; status: number; events: Record<string, unknown>[] }> {
    const r = await this.raw("POST", path, body);
    if (!r.res) return { ok: false, status: 0, events: [{ type: "error", message: `Deal Desk server unreachable at ${this.base} (${r.error})` }] };
    const events: Record<string, unknown>[] = [];
    for (const line of (await r.res.text()).split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { const e = JSON.parse(line) as Record<string, unknown>; events.push(e); onEvent?.(e); } catch { /* skip a partial line */ }
    }
    return { ok: r.res.ok, status: r.res.status, events };
  }

  private async raw(method: string, path: string, body?: unknown): Promise<{ res?: Response; error?: string }> {
    try {
      const res = await this.f(this.url(path), {
        method,
        headers: body === undefined ? { accept: "application/json" } : { "content-type": "application/json", accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { res };
    } catch (e) {
      const err = e as { name?: string; cause?: { code?: string }; message?: string };
      return { error: err?.cause?.code || err?.name || "fetch failed" };
    }
  }
}
