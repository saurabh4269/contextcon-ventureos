#!/usr/bin/env node
// Create (or update, idempotently) the "Deal Desk" ElevenLabs conversational agent, and store its id in .env.local as
// ELEVENLABS_AGENT_ID (never committed). Usage: node scripts/voice-agent-setup.mjs
// Docs: https://elevenlabs.io/docs/api-reference/agents/create · /agents/update · /agents/list
// The key is read from .env.local / the environment and is never printed.
import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.resolve(process.cwd(), ".env.local");
const BASE = "https://api.elevenlabs.io";
const NAME = "Deal Desk";

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("ELEVENLABS_"))) };
}

const env = readEnv();
const key = env.ELEVENLABS_API_KEY?.trim();
if (!key) { console.error("ELEVENLABS_API_KEY is not set (.env.local)."); process.exit(1); }

const SCREENS = ["today", "pipeline", "agent", "agents", "ask", "mandates", "portfolio", "brain", "settings"];
const PROMPT = `You are Deal Desk's analyst, a voice assistant inside Deal Desk, an operating system for venture capital investors built on Crustdata's company and people data.

Rules:
- Never invent numbers, names, funding amounts, headcounts or dates. You have no data of your own. Every fact must come from a tool or from the screen the user is on.
- When the user asks to find, source or screen companies (for example "find ten Indian B2B software companies founded since 2023 whose team grew by half"), call run_sourcing with their request restated clearly and completely, then say you've started the search and the results will appear on screen.
- When the user names a specific company by its website domain, call open_company with the domain (like "acme.com"). If you only have a name, ask for the website.
- When the user asks to go to a part of the app, call open_screen.
- Keep replies short: one or two spoken sentences. No lists, no markdown. Indian English is fine; amounts may be in crore or lakh if the user uses them.
- If you can't do something, say so plainly.`;

const TOOLS = [
  { type: "client", name: "run_sourcing", description: "Start a Crustdata sourcing search in Deal Desk for the user's request. The page navigates to the agent run and shows results.", expects_response: true, response_timeout_secs: 10,
    parameters: { type: "object", required: ["request"], properties: { request: { type: "string", description: "The full sourcing request in plain English, e.g. 'Find ten Indian B2B software companies founded since 2023 whose headcount grew 50% in a year'." } } } },
  { type: "client", name: "open_company", description: "Open the deal page for one company in Deal Desk.", expects_response: true, response_timeout_secs: 10,
    parameters: { type: "object", required: ["domain"], properties: { domain: { type: "string", description: "The company's website domain, e.g. 'razorpay.com'." } } } },
  { type: "client", name: "open_screen", description: "Navigate to a screen of Deal Desk.", expects_response: true, response_timeout_secs: 10,
    parameters: { type: "object", required: ["name"], properties: { name: { type: "string", enum: SCREENS, description: "Which screen to open." } } } },
];

const body = {
  name: NAME,
  tags: ["deal-desk"],
  conversation_config: {
    agent: {
      first_message: "Hi, I'm Deal Desk. What should we look for?",
      language: "en",
      prompt: { prompt: PROMPT, llm: env.ELEVENLABS_AGENT_LLM || "gemini-2.5-flash", temperature: 0.2, tools: TOOLS },
    },
    asr: { keywords: ["Crustdata", "Deal Desk", "B2B", "SaaS", "Series A", "Series B", "ARR", "headcount", "fintech", "Y Combinator"] },
    tts: { voice_id: env.ELEVENLABS_VOICE_ID || "nPczCjzI2devNBz1zQrb", model_id: "eleven_flash_v2" },
  },
  platform_settings: { auth: { enable_auth: true } }, // signed URLs only (the key stays on our server)
};

async function api(method, p, json) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "xi-api-key": key, "content-type": "application/json" }, body: json ? JSON.stringify(json) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

let id = env.ELEVENLABS_AGENT_ID?.trim();
if (id) {
  try { await api("GET", `/v1/convai/agents/${id}`); } catch { console.log(`Stored agent ${id} not found; looking up by name.`); id = undefined; }
}
if (!id) {
  const list = await api("GET", `/v1/convai/agents?search=${encodeURIComponent(NAME)}&page_size=30`);
  id = list.agents?.find((a) => a.name === NAME)?.agent_id;
}
if (id) {
  await api("PATCH", `/v1/convai/agents/${id}`, body);
  console.log(`Updated agent ${id}`);
} else {
  id = (await api("POST", "/v1/convai/agents/create", body)).agent_id;
  console.log(`Created agent ${id}`);
}

const cur = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
const next = /^ELEVENLABS_AGENT_ID=.*$/m.test(cur) ? cur.replace(/^ELEVENLABS_AGENT_ID=.*$/m, `ELEVENLABS_AGENT_ID=${id}`) : `${cur.replace(/\n?$/, "\n")}ELEVENLABS_AGENT_ID=${id}\n`;
if (next !== cur) { fs.writeFileSync(ENV_FILE, next); console.log("Wrote ELEVENLABS_AGENT_ID to .env.local"); }
