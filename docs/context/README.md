# docs/context: curated context for contributors and judges

Deal Desk is an agentic OS for venture investors (and, next, banks) built on Crustdata. ContextCon 03 @ IIT Bombay
(Techfest), 31 Oct 2026, theme **Investing**. Team: Saurabh Gupta ([saurabh4269](https://github.com/saurabh4269)) and
Shiwani Mishra.

Everything here was checked against the code on this branch. Where a doc and the code disagree, the code wins. Start
with the top-level [README](../../README.md) and [AGENTS.md](../../AGENTS.md).

| File | What it covers |
| --- | --- |
| [01-product-and-workflow.md](01-product-and-workflow.md) | The product, and the 10-step deal workflow with what is built and what is not |
| [02-architecture.md](02-architecture.md) | Stack, agents, the five layers, the request path, links to the diagrams |
| [03-api-and-crustdata.md](03-api-and-crustdata.md) | Every app API route, plus the Crustdata endpoints used and their credit costs |
| [04-trust-rules.md](04-trust-rules.md) | The trust rules and the file or test that enforces each one |
| [05-rubric-scorecard.md](05-rubric-scorecard.md) | ContextCon rubric self-scores: the initial score (55) and the re-score (82) |
| [06-workflow-audit.md](06-workflow-audit.md) | What the pre-event requirements audit found, and where each finding stands now |
| [07-nl-agent.md](07-nl-agent.md) | The `/ask` research agent: loop, tools, model config, citation checks |
| [08-decisions-contract.md](08-decisions-contract.md) | `GET /api/deals/:id/decisions`, `src/lib/numbers/decisions.ts`, `DEALDESK_BUILDER_URL` |
| [09-demo-runbook-and-setup.md](09-demo-runbook-and-setup.md) | Local setup, preflight, the demo click path and backups |
| [10-handoff-next-steps.md](10-handoff-next-steps.md) | State of play, known gaps and ranked next steps |
| [12-modes-of-interaction.md](12-modes-of-interaction.md) | `/ask`, the deal workflow, the MCP server and the `dealdesk` CLI |
