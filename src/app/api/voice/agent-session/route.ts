// GET /api/voice/agent-session?probe=1 → { available, reason } (no upstream call)
// GET /api/voice/agent-session → { signedUrl, agentId, source } for a WebSocket conversation with the Deal Desk agent.
// 503 not_connected when ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID is missing (the client falls back to the plain orb);
// 502 upstream errors carry the ElevenLabs status + message (mapped like STT: key_invalid / quota_exceeded / …).
import { NextResponse } from "next/server";
import { agentConfig, getSignedUrl } from "@/lib/voice/agent";
import { mapSttError } from "@/lib/voice/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const source = { provider: "ElevenLabs Agents", endpoint: "GET /v1/convai/conversation/get-signed-url" };

export async function GET(req: Request) {
  const c = agentConfig();
  // ?probe=1 → {available} without minting a URL (lets the orb decide between live agent and the brief fallback)
  if (new URL(req.url).searchParams.get("probe") === "1") return NextResponse.json({ available: c.ok, reason: c.ok ? null : c.missing === "key" ? "not_connected" : "no_agent" }, { headers: NO_STORE });
  if (!c.ok) return NextResponse.json({ status: "not_connected", code: c.missing === "key" ? "not_connected" : "no_agent", message: c.missing === "key" ? "ElevenLabs is not configured: set ELEVENLABS_API_KEY on the server." : "No voice agent configured: run `node scripts/voice-agent-setup.mjs` to create one (sets ELEVENLABS_AGENT_ID).", source }, { status: 503, headers: NO_STORE });
  let up: Response;
  try { up = await getSignedUrl(c.cfg, req.signal); }
  catch (e) { return NextResponse.json({ status: "error", code: "upstream_error", message: `ElevenLabs request failed: ${e instanceof Error ? e.message : String(e)}`, source }, { status: 502, headers: NO_STORE }); }
  if (!up.ok) {
    const m = mapSttError(up.status, await up.text().catch(() => ""));
    console.error(`[voice] ElevenLabs signed-url → ${up.status} (${m.code})`);
    return NextResponse.json({ status: "error", code: m.code, upstreamStatus: up.status, message: m.message.replace("speech-to-text", "conversational agent"), source }, { status: m.httpStatus === 422 ? 502 : m.httpStatus, headers: NO_STORE });
  }
  const j = (await up.json().catch(() => null)) as { signed_url?: string } | null;
  if (!j?.signed_url) return NextResponse.json({ status: "error", code: "upstream_error", message: "ElevenLabs returned no signed_url.", source }, { status: 502, headers: NO_STORE });
  return NextResponse.json({ signedUrl: j.signed_url, agentId: c.cfg.agentId, source }, { headers: NO_STORE });
}
