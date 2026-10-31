# CLAUDE.md

Read [AGENTS.md](AGENTS.md): repo map, commands, the product rules (no demo data, `ComputedField` + citations,
money/IST, outbound dry-run, secrets server-side), how to add a Crustdata call, and the test guards.
Current state: [docs/HANDOFF.md](docs/HANDOFF.md). Why things are the way they are: [docs/DECISIONS.md](docs/DECISIONS.md).

Short version:
- Dev server: `npm run dev` (port 3240; check it isn't already running). Gate: `npm run typecheck && npm test`.
- Never run `npm run build` while `next dev` runs in the same directory.
- Never print, log or commit secrets. Never add demo data. Never send anything outbound.
