# Deal Desk by VentureOS

An agentic OS for VCs and banks, built on Crustdata. Live at https://contextcon.ventureos.xyz

This repo holds the Deal Desk web UI (Next.js 15, React 19, Tailwind 4, Recharts). Screens include Today, Assistant, Pipeline, Deal, IC memo, Person, Portfolio, Firm brain, Agents and Agent flow, Connectors (Settings) and Landing. The data shown comes from fixtures in `port/src/fixtures`. Live connectors show a "not connected" state until they are configured.

## Run locally

```bash
npm ci
npm run dev      # http://localhost:3240
npm run build && npm start
```

## Layout

- `src/app`: Next.js routes
- `port/src/screens`: one component per screen
- `port/src/components`: shared UI
- `port/src/fixtures`: demo data
