import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/voice/agent-session/route";
import { toolRoute } from "./agentTools";

describe("toolRoute (agent client tools)", () => {
  it("run_sourcing → /agent?q=", () => expect(toolRoute("run_sourcing", { request: "Find ten Indian B2B SaaS companies" })).toEqual({ href: "/agent?q=Find%20ten%20Indian%20B2B%20SaaS%20companies" }));
  it("run_sourcing post-corrects agent ASR (\"Crust Data\")", () => expect(toolRoute("run_sourcing", { request: "SaaS on Crust Data" })).toEqual({ href: "/agent?q=SaaS%20on%20Crustdata" }));
  it("run_sourcing needs a request", () => expect(toolRoute("run_sourcing", {})).toHaveProperty("error"));
  it("open_company normalises the domain", () => expect(toolRoute("open_company", { domain: "https://www.Razorpay.com/about" })).toEqual({ href: "/deal?domain=razorpay.com" }));
  it("open_company rejects a bare name", () => expect(toolRoute("open_company", { domain: "Razorpay" })).toHaveProperty("error"));
  it("open_screen allows known screens only", () => {
    expect(toolRoute("open_screen", { name: "Pipeline" })).toEqual({ href: "/pipeline" });
    expect(toolRoute("open_screen", { name: "../admin" })).toHaveProperty("error");
  });
});

describe("GET /api/voice/agent-session", () => {
  beforeEach(() => { process.env.ELEVENLABS_API_KEY = "test-key"; process.env.ELEVENLABS_AGENT_ID = "agent_x"; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.ELEVENLABS_API_KEY; delete process.env.ELEVENLABS_AGENT_ID; });
  const req = (qs = "") => new Request(`http://localhost/api/voice/agent-session${qs}`);

  it("returns a signed URL from ElevenLabs (key server-side)", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({ signed_url: "wss://example/conv?sig=1" }); });
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ signedUrl: "wss://example/conv?sig=1", agentId: "agent_x" });
    expect(calls[0]!.url).toBe("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=agent_x");
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
  });
  it("probe reports availability without calling upstream", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect(await (await GET(req("?probe=1"))).json()).toEqual({ available: true, reason: null });
    delete process.env.ELEVENLABS_AGENT_ID;
    expect(await (await GET(req("?probe=1"))).json()).toEqual({ available: false, reason: "no_agent" });
    expect(f).not.toHaveBeenCalled();
  });
  it("503 when no agent is configured; maps invalid key honestly", async () => {
    delete process.env.ELEVENLABS_AGENT_ID;
    expect((await GET(req())).status).toBe(503);
    process.env.ELEVENLABS_AGENT_ID = "agent_x";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ detail: { status: "invalid_api_key", message: "Invalid API key" } }), { status: 401 }));
    const r = await GET(req());
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ code: "key_invalid", upstreamStatus: 401 });
  });
});
