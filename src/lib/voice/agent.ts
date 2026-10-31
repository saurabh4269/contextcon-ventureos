// ElevenLabs Agents platform (server only). The "Deal Desk" agent is created by scripts/voice-agent-setup.mjs, which
// stores its id in .env.local as ELEVENLABS_AGENT_ID. The browser never sees the key: it gets a short-lived signed
// WebSocket URL from GET /api/voice/agent-session.
// Docs: https://elevenlabs.io/docs/api-reference/conversations/get-signed-url
import { ELEVENLABS_BASE_URL } from "./elevenlabs";

export type AgentConfig = { apiKey: string; agentId: string };

export function agentConfig(env: Record<string, string | undefined> = process.env): { ok: true; cfg: AgentConfig } | { ok: false; missing: "key" | "agent" } {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return { ok: false, missing: "key" };
  const agentId = env.ELEVENLABS_AGENT_ID?.trim();
  if (!agentId) return { ok: false, missing: "agent" };
  return { ok: true, cfg: { apiKey, agentId } };
}

export function getSignedUrl(cfg: AgentConfig, signal?: AbortSignal, f: typeof fetch = fetch) {
  return f(`${ELEVENLABS_BASE_URL}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(cfg.agentId)}`, { headers: { "xi-api-key": cfg.apiKey }, signal, cache: "no-store" });
}
