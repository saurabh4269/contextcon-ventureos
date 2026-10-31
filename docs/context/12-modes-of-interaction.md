# 12 · Modes of interaction

Deal Desk has one set of server logic: the Next.js route handlers in `src/app/api/*` (contracts in `docs/API.md`).
There are four ways to use it. Each one is a front end over the same routes, so the same trust rules apply in every
mode: values carry citations or are unavailable with a reason, there is no demo data, and nothing is sent outbound
without a person's approval.

| Mode | Entry point | Server logic it calls |
| --- | --- | --- |
| Single agent | `/ask` in the app | `POST /api/live/screen` (`src/lib/agent`) |
| System of agents | `/agent`, `/deal`, `/review` in the app | `POST /api/sourcing/run`, `GET /api/live/research`, `GET /api/deals/:id/decisions`, `/api/exceptions` |
| MCP server | Claude Desktop, Cursor, any MCP client | `src/mcp/server.ts` → the routes above over HTTP |
| CLI | `dealdesk` in a terminal | `src/cli/index.ts` → the same handlers as the MCP server |

## 1. Single agent: the `/ask` research agent

You type a plain-English request. One LLM agent plans, calls Crustdata tools, relaxes or re-queries when there are
too few matches, and returns a shortlist. The server then checks every cell against the raw tool responses
(`src/lib/agent/cite.ts`). Cells come back as verified, corrected or unavailable, and each has a citation (endpoint,
JSON path, time retrieved). With no model key the route returns `model_unavailable` (503), and `/ask` offers the
deterministic Sourcing agent instead. Details: [07-nl-agent.md](07-nl-agent.md).

## 2. System of agents: workflow pipeline, verifier, review queue

- **Pipeline.** The Sourcing agent (`/agent`) runs parse → search → relax → verify → founders → rank → memory as
  separate steps, streamed as NDJSON. For one company, the deal workflow is research (`/api/live/research`) →
  decisions (`/api/deals/:id/decisions`) → review → outreach.
- **Verifier.** Rows that fail enrichment checks are dropped and listed with a reason. `enforceCited` withholds
  any value that has no source. Builder-backend values are accepted only when they are cited ([08](08-decisions-contract.md)).
- **Review queue.** Agents finish everything they can verify. They raise an item in `/review` only when a person is
  needed: missing or conflicting data, low confidence, an ambiguous match, a credit threshold, or any outbound send.
  Approving an outbound send is a dry run.

## 3. MCP server

`npm run mcp` starts `src/mcp/server.ts` on stdio (`@modelcontextprotocol/sdk`). It is thin: each tool calls a
Deal Desk route over HTTP at `DEALDESK_URL` (default `http://localhost:3240`; the deployed site works too), so the app has to be running
(`npm run dev`). API keys stay in the app, which loads them from `.env.local`. The MCP process needs only
`DEALDESK_URL`.

| Tool | Input | Route | Result |
| --- | --- | --- | --- |
| `screen_companies` | `request` (plain English) | `POST /api/live/screen` | The research agent's cited shortlist (`ScreenResult`) |
| `research_company` | `domain` | `GET /api/live/research` | Cited company profile |
| `get_decisions` | `domain`, `review?` | `GET /api/deals/:id/decisions` | `summary.<key>`: `{status:"ok", value, sources}` or `{status:"unavailable", reason}` |
| `run_deal_workflow` | `domain`, `until?`, `outreach?` | research → decisions → `/api/exceptions?run=` → `POST /api/outbound/email` (`draft`) | Steps with status; the outreach step is always `needs_approval` and never sends |
| `list_review_queue` | `status?`, `run?` | `GET /api/exceptions` | Open items with their evidence |
| `approve_review_item` | `id`, `confirm?`, `note?` | `POST /api/exceptions/:id` | A dry run unless `confirm=true` **and** `DEALDESK_ALLOW_APPROVE=1`. Outbound items stay dry-run on the server |
| `deal_workflow_start` | `domain`, `name?` | `POST /api/workflow` `{from:"ask"}` | The ten-step deal workflow's id; the run continues on the server |
| `deal_workflow_list` | — | `GET /api/workflow` | Deals with stage and the step that waits; `storage` says if it is durable |
| `deal_workflow_get` | `id` | `GET /api/workflow/:id` | Steps, facts and their citations (addresses masked) |
| `deal_workflow_act` | `id`, `action`, `step?`, `text?`, `verdict?`, `note?`, `confirm?` | `POST /api/workflow/:id` | transcript, skip_transcript, override_screen, decide, regenerate_memo, resume. `approve` is a dry run unless `confirm=true` **and** `DEALDESK_ALLOW_APPROVE=1`; the server still sends only with `OUTBOUND_MODE=live` to allowlisted recipients |

Every result is `{ ok, tool, status, data, sources[] }`. `sources` is gathered from the route's own citations;
the MCP layer computes nothing.

Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`). Placeholders only; use your own path:

```json
{
  "mcpServers": {
    "dealdesk": {
      "command": "npx",
      "args": ["tsx", "/path/to/dealdesk/src/mcp/server.ts"],
      "env": { "DEALDESK_URL": "http://localhost:3240" }
    }
  }
}
```

Put the app's keys (`CRUSTDATA_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, …) in `.env.local` as listed in
`.env.example`. The app reads them and the MCP process never sees them. Never paste keys into `mcp.json`. Leave
`DEALDESK_ALLOW_APPROVE` unset unless you want the client to be able to settle review items.

## 4. CLI: `dealdesk`

`npm run dealdesk -- <command>` or `npx tsx src/cli/index.ts <command>` (`bin.dealdesk` in `package.json`, so
`npm link` puts it on your PATH). The app must be running, as for MCP.

```
dealdesk ask "seed-stage AI infra startups in Berlin with 10-50 people"
dealdesk research e2b.dev
dealdesk decisions e2b.dev [--no-review]
dealdesk workflow e2b.dev [--until research|decisions|review|outreach]
dealdesk review list [--all] [--run deal:e2b.dev:decisions]
dealdesk review approve <id> [--confirm] [--note "…"]
dealdesk deal start efficieno.ai [--name "Efficieno AI"]
dealdesk deal list
dealdesk deal show <id>
dealdesk deal act <id> transcript --text "We are a team of 60 …"
dealdesk deal act <id> decide --verdict invest
dealdesk doctor              # runs scripts/doctor.mjs (connector health, values never printed)
```

Output is readable text with a numbered source list. Add `--json` for the raw `{ok, data, sources}` result. Exit
codes: 0 ok, 1 failed (including an unreachable server), 2 usage error.

Tests: `src/mcp/tools.test.ts` (handlers and the MCP protocol, with mocked HTTP) and `src/cli/args.test.ts`.
