"use client";
// Agents: the agents that really exist in this build, each with the routes, Crustdata endpoints and tools it uses.
// Nothing here is a run count or a status claim; the live status of each connector is on Settings › Connectors.
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Page, TopBar } from "@port/components/shell";
import { Mascot } from "@port/components/brand/mascot";
import { liveShell } from "@/live/shell";

type AgentInfo = { id: string; name: string; what: string; href?: string; open?: string; route: string; endpoints: string[]; tools: string[]; needs: string };

const AGENTS: AgentInfo[] = [
  {
    id: "screening", name: "Research agent (LLM)", href: "/ask", open: "Open",
    what: "Any natural-language request: the model plans, picks Crustdata tools, checks every row against the ask, re-queries or relaxes (disclosed), and answers with a ranked table. Every value is checked against the cited Crustdata response before it is shown. Without a model key it says so and offers the Sourcing agent.",
    route: "POST /api/live/screen (NDJSON step stream)",
    endpoints: ["POST /company/search", "POST /company/enrich", "POST /person/search", "POST /person/enrich", "POST /company/identify", "POST /job/search", "POST /web/search/live"],
    tools: ["search_companies", "search_people", "enrich_companies", "enrich_person", "identify_company", "company_signals", "find_founders", "search_jobs", "web_search"],
    needs: "OpenAI (OPENAI_API_KEY) or Anthropic key + Crustdata",
  },
  {
    id: "sourcing", name: "Sourcing agent", href: "/agent", open: "Open",
    what: "A free-text request becomes a Crustdata search. Constraints are relaxed one at a time (disclosed, never padded), every company is verified, founders and their past employers are found, and the list is ranked with a stated reason. Deterministic: no LLM.",
    route: "POST /api/sourcing/run (NDJSON step stream)",
    endpoints: ["POST /company/search", "POST /company/enrich", "POST /person/search", "POST /person/enrich", "POST /company/identify"],
    tools: ["request parser", "relaxation", "ranker", "memo (markdown) + CSV export", "firm memory"],
    needs: "Crustdata",
  },
  {
    id: "company", name: "Company research", href: "/deal", open: "Open",
    what: "One company by domain: profile, headcount and funding with citations, founders, open roles, recent news and comparables.",
    route: "GET /api/live/research?domain=",
    endpoints: ["POST /company/identify", "POST /company/enrich", "POST /person/search", "POST /job/search", "POST /web/search/live", "POST /company/search"],
    tools: ["explainable numbers (cited fields)", "firm memory"],
    needs: "Crustdata",
  },
  {
    id: "person", name: "Person research", href: "/person", open: "Open",
    what: "One person by LinkedIn profile URL: current and past roles, education, with the source of each line.",
    route: "GET /api/live/person?linkedin=",
    endpoints: ["POST /person/enrich"],
    tools: ["firm memory"],
    needs: "Crustdata",
  },
  {
    id: "voice", name: "Voice assistant",
    what: "Speak a request: speech-to-text fills the request box, spoken briefs read results back, and the conversational session can run sourcing or open a company.",
    route: "POST /api/voice/stt · /api/voice/tts · /api/voice/brief · /api/voice/agent-session",
    endpoints: ["ElevenLabs speech-to-text", "ElevenLabs text-to-speech", "ElevenLabs conversational agent"],
    tools: ["run_sourcing", "open_company", "open_screen"],
    needs: "ElevenLabs",
  },
  {
    id: "memory", name: "Firm memory", href: "/brain", open: "Open",
    what: "Every research run, sourcing run and opened deal is appended to organizational memory and streamed live to the memory panels.",
    route: "GET/POST /api/memory/events · GET /api/memory/stream (SSE)",
    endpoints: ["Postgres (DATABASE_URL)"],
    tools: ["recordMemory (server)", "recordEvent (client)"],
    needs: "Postgres",
  },
];

export default function Agents() {
  return (
    <Page active="agents" shell={liveShell} top={<TopBar crumbs={[{ label: "Agents" }]} ctx="Agents" />}>
      <div className="mx-auto w-full max-w-[980px] px-4 pt-7 pb-24 sm:px-6">
        <header className="flex items-start gap-4">
          <Mascot size={56} mood="happy" className="hidden shrink-0 sm:block" />
          <div className="min-w-0">
            <h1 className="serif text-[28px] leading-tight tracking-[-0.01em] sm:text-[32px]">Agents in this build</h1>
            <p className="mt-1.5 max-w-[640px] text-[13.5px] text-zinc-500">
              What each one does and exactly which endpoints it calls. Connector status lives in <Link href="/settings?section=connectors" className="text-rust underline-offset-2 hover:underline">Settings › Connectors</Link>.
            </p>
          </div>
        </header>
        <ul className="mt-6 grid gap-3 md:grid-cols-2" data-testid="agents-list">
          {AGENTS.map((a) => (
            <li key={a.id} data-agent={a.id} className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-ink">{a.name}</div>
                  <div className="text-[11.5px] text-zinc-400">needs {a.needs}</div>
                </div>
                {a.href && (
                  <Link href={a.href} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-zinc-800">
                    {a.open}<ArrowUpRight className="size-3.5" />
                  </Link>
                )}
              </div>
              <p className="mt-2 text-[13px] leading-snug text-zinc-600">{a.what}</p>
              <div className="mt-3 font-mono text-[11px] break-words text-zinc-500">{a.route}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.endpoints.map((e) => <span key={e} className="rounded-full bg-[#faf3ec] px-2 py-0.5 font-mono text-[10.5px] text-[#7a3a10] ring-1 ring-[#ecd9c6]">{e}</span>)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.tools.map((t) => <span key={t} className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200">{t}</span>)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
