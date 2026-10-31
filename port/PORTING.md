# Deal Desk UI: port bundle

Paste-ready UI for `cursor/deal-desk-mvp-3fe8` (built against bf567c9 from the outside; the box couldn't clone it).
Everything under `src/` is plain React 19 + Tailwind v4 + framer-motion, typed, data-in/callbacks-out.
**No fetching inside screens.** Your route files fetch, map to the types in `src/types.ts`, and pass callbacks.

```
port/
  PORTING.md            this file
  NEW_SCREENS.md        the 12 folded-in items + hold/undo + Slack card: intent, placement, atlas refs, props
  package.snippet.json  exact versions + 2 scripts
  tsconfig.json         standalone typecheck of src + test
  src/
    types.ts            every data shape (API contract the screens expect)
    routes.ts           every href the UI emits: edit this one file to match the app
    styles/globals.css  Tailwind v4 @theme tokens + 8 utility classes + v3.1 chart tokens (.dd-chart, .dd-tip)
    lib/format.ts       money/number formatting
    lib/utils.ts        cn() = clsx + tailwind-merge (shadcn convention)
    components/         shell, ui, motion, states, overlays, dealhead, dealteam, firm, gates, outbound, priors, slack, wall, providers, charts (v3.1 shadcn/Recharts), brainviz (v3.1), growthcard (v3), ui/chart.tsx (shadcn chart primitives)
    screens/            today, onboarding, pipeline (table/board/watchlist), portfolio, mandates, deal (+restricted), dataroom, memo, brain, settings, slackpreview
    fixtures/           realistic data for every screen + variant (also the demo seed)
  test/render.test.tsx  server-renders every screen × variant × state (81 cases, incl. v3 Helio frames)
  tools/                shots.mjs (reference PNGs), interactcheck.mjs (SrcPop + board drag/keyboard), sidebyside_port.py
  reference/*.png       54 shots, 1440×900 @1x, viewport (pixel targets; v3 adds 20 Helio/state frames)
  reference/full/*.png  same 54, full height
  reference/compare/    17 side-by-sides vs the UI atlas, scored
```

## 1. Install (≈10 min)

1. Merge `package.snippet.json` into `package.json` → `npm i`.
2. Copy `port/src` to e.g. `src/dealdesk/` and add a path alias `"@port/*": ["src/dealdesk/*"]` (or rewrite the relative imports; there are no `@port` imports *inside* src).
3. **CSS.** Import `src/styles/globals.css` once (root layout), and tell Tailwind to scan the folder:
   ```css
   @import "tailwindcss";
   @source "../dealdesk";   /* path relative to the css file */
   ```
   The `@theme` block defines `--color-canvas #fafafa`, `--color-ink #09090b`, `--color-rust #9c440f` (+`-50/-100`), `ok #3d6b4f`, `warn #8a5b12`, and fonts.
   If the app already has a `@theme`, merge these tokens; **don't rename them**, the components use `bg-rust`, `text-ink`, `text-ok` etc.
4. **Fonts** (root layout):
   ```tsx
   import { GeistSans } from "geist/font/sans";
   import { GeistMono } from "geist/font/mono";
   import "@fontsource-variable/newsreader/opsz.css";
   import "@fontsource-variable/newsreader/opsz-italic.css";
   <html className={`${GeistSans.variable} ${GeistMono.variable}`}><body><Providers>{children}</Providers></body></html>
   ```
5. **Motion.** Wrap the app in `components/providers.tsx` → `<MotionConfig reducedMotion="user">`. CSS also kills keyframes/transitions under `prefers-reduced-motion`. All motion primitives live in `components/motion.tsx` (`Rise`, `Pop`, `Grow`, `DrawPath`, `Sweep`, `Count`); nothing else animates.
6. **Client boundary.** Screens use hooks + framer-motion → render them from a `"use client"` file (or put `"use client"` on the route's client component). Server components fetch and pass props.
7. **Links.** All hrefs come from `src/routes.ts`. Our mockup used query params (`/deal?id=`); change to `/deals/${id}` etc. there only.
8. Verify:
   ```bash
   npx tsc --noEmit -p port                                        # → exit 0
   npx tsx --tsconfig port/tsconfig.json port/test/render.test.tsx # → 62/62 renders passed
   node port/tools/interactcheck.mjs   # needs the app running + playwright; adjust BASE + routes at the top
   ```
   Results at bundle time (31 Oct 2026 IST): **tsc exit 0 · 62/62 renders · interactcheck all PASS**.

## 2. Conventions

- Every screen prop extends `ScreenStatus { status?: "ready" | "loading" | "empty" | "error"; error?: string; onRetry?: () => void }`.
  `loading` → `ScreenSkeleton`, `error` → `ErrorState` (message + Retry), `empty` → `EmptyState` with one primary action. Shell and top bar always render, so nav never jumps.
- Callbacks are optional. Mutations that can fail are typed `() => void | Promise<void>`: the UI updates **optimistically**, and if your promise rejects it **rolls back** (claim, stage move, thesis proposal decision, request access, config patch).
- Exactly one `variant="primary"` button per card. Primary = ink (black); rust `#9c440f` is the *only* accent (flags, variances, live dots, the CapRange marker).
- Mode: `shell.mode` = `"invest" | "bank"`. Investing nav: Today · Pipeline · Portfolio · Firm brain. Banking nav: Today · Pipeline · Mandates · Firm brain. Settings lives in the sidebar footer. **No new tabs or sidebar items were added** for any of the 12 new items.
- Vocabulary: VC = **Pre-money**; bank = **EV** + football field; "Doesn't tie out" only in banking. Valuation label format: `Our range $117–149M · cap $133M`.
- Sources: `<Src k="…">` chip and `SrcPop` (closed by default; hover/focus opens, click pins, outside click closes; `pinSources` prop pins all for screenshots). It is positioned so it never covers the GM/NRR chips.

## 3. Screens

`shell: ShellData` is on every screen (user, firm, mode, nav counts, agentsWorking). Types are in `src/types.ts`; names below are exact.

| Screen | Route (mockup → suggested) | Component(s) | Data type | Callbacks | States | Ref PNG |
|---|---|---|---|---|---|---|
| Today · invest | `/today` | `TodayScreen` | `TodayData` | `onAsk(q?)`, `onDecision(cardId, actionId)`, `onUndoBatch(batchId)`, `onPrep(meetingId)`, `onOpenTile(tileId)`, `onUndoSend(outboundId)`, `onSendNow(outboundId)` | L/E/Err | today |
| Today · bank | `/today?mode=bank` | same, `shellBank` + `todayBank` | `TodayData` | same | L/E/Err | today-banking |
| Hold queue (on Today) | `/today?hold=1` | `OutboundQueue`, `HoldToast`, `HoldRing` (in Today) | `TodayData.outbound: OutboundItem[]`, `holdMinutes`, `tick` | `onUndoSend`, `onSendNow` | empty → hidden | hold-queue |
| Agent run | `/today?run=1` | `RunPanel` passed as `overlay` | `AgentRun` | `onClose`, `onPause`, `onPrimary`, `onUndo(id)` | status running/paused/done/failed | agent-run |
| ⌘K | `/today?k=1` | `CommandPalette` overlay | `PaletteData` | `onSelect(id)`, `onClose`, `onRequestAccess(codename)` | `denied?` → `DenialNote` | command-k, command-k-denied |
| Ask (⌘J) | `/today?ask=1` | `AskPanel` overlay | `AskData` (`answer.kind: "answer" \| "denied"`) | `onClose`, `onFollowUp(q)`, `onRequestAccess(codename)` | denied | ask, ask-denied |
| First run / onboarding | `/today?first=1&step=1..5` → `/onboarding` | `OnboardingScreen` | `OnboardingData` (+ `slackPreview: SlackMessage`) | `onStep`, `onChange(patch)`, `onNext`, `onBack`, `onFinish(data)`, `onConnect(provider)`, `onAsk`; `busy`, `error` | busy / error banner | first-run, onboarding-1…5 |
| Pipeline · table | `/pipeline` | `PipelineTableScreen` | `PipelineTableData` | `PipelineCallbacks`: `onOpenDeal`, `onAddDeal`, `onExport`, `onChangeView`, `onUndo` | L/E/Err | pipeline |
| Pipeline · board | `/pipeline?board=1` | `PipelineBoardScreen` | `PipelineBoardData` | + `onMoveStage(dealId, toStage) → void \| Promise` (drag **and** keyboard: focus card, Space, ←/→, Space; Esc cancels) | L/E/Err | pipeline-board |
| Watchlist | `/pipeline?view=watchlist` | `WatchlistScreen` | `WatchlistData` | `onSelect`, `onAction`, `onAdd`, `onClosePanel` | L/E/Err (side panel keeps last data) | watchlist |
| Portfolio (invest) | `/portfolio` | `PortfolioScreen` | `PortfolioData` | `onSelect`, `onExport`, `onAction`, `onOpenReport` | L/E/Err | portfolio |
| Mandates (bank) | `/mandates?m=` | `MandatesScreen` (+`GateChecklist`, `GateStrip`) | `MandatesData` (`gates?: MandateGate[]`) | `onSelectMandate`, `onSection`, `onExport`, `onDraftReminders`, `onOpenBuyer`, `onOpenQa`, `onExportField("pptx"\|"xlsx")`, `onGateAction(gateId)` | L/E/Err; gated (`m=cobalt`) | mandates, mandates-gated |
| Deal | `/deal?id=` → `/deals/[id]` | `DealScreen` (+`DealHead`, `DealTeamPanel`) | `DealData` (`team: DealTeam`) | `onOpenRoom`, `onOpenMemo`, `onOutline`, `onAsk`, `onClaim`, `onAssign(userId)`, `onUndoClaim`; `pinSources` | L/E/Err | deal-page, deal-pinned, deal-team-open |
| Deal · restricted | same route, on 403 | `RestrictedDealScreen` | `RestrictedDeal` | `onRequestAccess(codename)`, `onWithdraw`; `channel?`, `mode?` | requested / not | deal-restricted |
| Data room | `/deal/room?id=` | `DataRoomScreen` | `DataRoomData`; `walled?` | `onRequestMissing`, `onOpenFolder`, `onOpenFile` | L/E/Err | data-room |
| IC memo | `/memo?id=` | `MemoScreen` (+`PriorsStrip`) | `MemoData` (`priors?: ValuationPriors`) | `onOutline`, `onCite(n)`, `onExport("docx"\|"pdf")`; `pinSources` | L/E/Err; no priors → strip hidden | ic-memo, memo-priors |
| Firm brain | `/brain` | `BrainScreen` | `BrainData` (`outcomes`, `priors`, `proposals`) | `onSelectKind`, `onEditMemory`, `onUndoLearned`, `onDecideProposal(id, decision)`, `onUndoDecision(id)`, `onExport` | L/E/Err; empty memories | firm-brain |
| Settings | `/settings?section=workflow\|integrations\|members\|access\|export` | `SettingsScreen` (+`AutonomyControl`, `Segmented`, `Stepper`, `Field`, `Chip`) | `SettingsData`, `section` | `onSection`, `onPatchConfig(patch)`, `onConnect`, `onCopyMcp`, `onToggleBrief`, `onToggleGuardrail`, `onInvite`, `onChangeRole`, `onManageWall`, `onNewWall`, `onExportAudit`, `onExportBundle()`, `onSaveKey(provider, key)`, `onRemoveKey` | L/E/Err; non-admin (`isAdmin:false`): Access audit hidden (direct link → "Admins only"), no Invite, roles read-only | settings, settings-integrations, settings-members, settings-access, settings-export |
| Slack/Teams cards | `/preview/slack` (design ref only, not app nav) | `SlackPreviewScreen`, `SlackCard`, `SlackFrame` | `SlackMessage[]` | `onAction(messageId, buttonId)` | ephemeral | slack-preview |

Key prop shapes (verbatim from `types.ts`, the ones new in this pass):

```ts
type Autonomy = 0 | 1 | 2 | 3;
interface FirmConfig { mode: Mode; thesis: { sectors: string[]; stages: string[]; geos: string[]; checkSize: { min: number; max: number; unit: "K"|"M"|"B" }; ownershipTarget?: number };
  stages: { id: ID; label: string }[]; passTemplates: { id: ID; reason: string; preview: string; uses: number }[];
  autonomy: Autonomy; holdMinutes: number; ownerRule: "assign_directly" | "ask_first" }
interface FirmMember { id; name; initials; email; role: string; walls: string[]; status: "active" | "invited" }
interface WallGroup { id; codename: string; members: number; approver: string; restricted: boolean }
interface AccessDeniedRow { id; at: string; who: string; target: string; surface: "web"|"ask"|"cmdk"|"slack"|"mcp"|"api"; reason: string }
interface ExportData { lastExport?: string; contents: string[]; keys: { id; provider: string; masked: string | null; addedAt?: string }[] }
interface RestrictedDeal { restricted: true; codename: string; reason: string; stageLabel?: string; requested?: boolean; approverRole: string }
interface AccessDenial { codename: string; reason: string; requestable: boolean }
interface DealTeam { members: DealMember[]; sourcedBy: { initials; name; via: string; at: string; locked: boolean };
  suggestion: OwnerSuggestion | null; canClaim: boolean; ownerRule: "assign_directly" | "ask_first" }
interface OwnerSuggestion { userId; initials; name; reasons: string[]; confidence: number }
interface ThesisProposal { id; field: string; from: string; to: string; why: string; evidence: string; proposedBy: string }
type ProposalDecision = "approve" | "reject";
interface ValuationPriors { basisLabel: string; arr: number; comparable: { company; multiple: number; outcome; tone }[]; median: number;
  band: { low; high }; axis: { min; max }; source: SourceRef; implied: { low; high }; note: string }
interface OutboundItem { id; to; subject; app: "Gmail"|"Outlook"; status: "holding"|"sent"|"undone"; secondsLeft: number; holdSeconds: number; approvedBy: string }
interface MandateGate { id: "conflicts"|"engagement"|"kyc"; label; state: "cleared"|"pending"|"blocked"|"todo"; detail; owner; at? }
interface OnboardingData { step: 1|2|3|4|5; steps: string[]; firm: {...}; prefill?: {...}; invites: { email; role; suggested?; why? }[];
  roles: string[]; channel: "slack"|"teams"; autonomy: Autonomy; holdMinutes: number; working: { id; state; label; value }[] }
```

## 4. Endpoint mapping

`✓` = given in the brief/steer. `@assumed` = my guess at the name/shape; check against the real routes and adjust the mapper, not the component.

| UI | Call | Request → response mapped to | Notes |
|---|---|---|---|
| Settings · Workflow (thesis, stages, pass templates, autonomy, hold, owner rule) | ✓ `GET /api/firm/config` · ✓ `PATCH /api/firm/config` | `FirmConfig`; PATCH body = changed fields only | autosave, "Saved" tick; reject → rollback |
| Settings · Integrations | `GET /api/integrations` @assumed | `Integration[]` (`status: on/fix/off`) | `onConnect(id)` → OAuth start URL @assumed |
| Settings · Members & walls | ✓ `firm_members` table; `GET/PATCH /api/firm/members` @assumed; `POST /api/firm/invites` @assumed; walls `GET/POST /api/firm/walls` @assumed | `FirmMember[]`, `WallGroup[]`, `roles[]` | role change = PATCH member; admin only |
| Settings · Access audit | ✓ `access_denied_log`; `GET /api/firm/access-log` @assumed | `AccessDeniedRow[]` | **admin only**; tab hidden when `isAdmin=false`; `onExportAudit` → CSV @assumed |
| Settings · Export & keys | ✓ `POST /api/firm/export` → `{url,size}` @assumed shape; keys `POST/DELETE /api/firm/llm-keys` @assumed | `ExportData` | raw key sent once; server returns `{masked}` only, **never the key** |
| Onboarding | ✓ `POST /api/firm/onboarding` (on step 5 `onFinish(data)`) | `OnboardingData` | steps 1–4 can PATCH config as they go (@assumed) |
| Deal | `GET /api/deals/[id]` | `DealData` | |
| Deal · restricted | ✓ `GET /api/deals/[id]` → **403** `{restricted, codename, reason}` | `RestrictedDeal` (add `approverRole`, `stageLabel?`, `requested?` @assumed) | render `RestrictedDealScreen` instead of DealScreen |
| Request access | `POST /api/deals/[id]/access-requests` @assumed | — | logs to access_denied_log + Slack card to approver |
| Deal team · Claim | ✓ `POST /api/deals/[id]/claim` | → updated `DealTeam` | optimistic; Undo → `DELETE …/claim` @assumed |
| Deal team · suggestion | ✓ `GET /api/deals/[id]/owner-suggestion` | `OwnerSuggestion \| null` | `onAssign(userId)` → `POST /api/deals/[id]/assign` @assumed; `ownerRule` decides button copy |
| Sourced by | part of deal payload @assumed (`sourced_by`, from email headers) | `DealTeam.sourcedBy` | `locked: true` → agent can't change it |
| Ask (⌘J) | ✓ `POST /api/concierge/ask` | `AskData`; denial → `answer.kind:"denied"` | denial rendered only to the asker |
| ⌘K search | `GET /api/search?q=` @assumed | `PaletteData` (`denied?`) | walled hit returns codename only |
| Valuation | `GET /api/deals/[id]/valuation` @assumed | `Valuation` (VC: pre-money range + cap; bank: football field) | |
| IC memo priors | `GET /api/firm/priors?deal=` @assumed (or in memo payload) | `ValuationPriors` | hidden when absent |
| Firm brain · thesis proposals | ✓ `GET /api/firm/thesis-proposals` · ✓ `POST /api/firm/thesis-proposals/[id]` `{decision}` | `ThesisProposal[]` | optimistic; Undo link → `onUndoDecision` |
| Firm brain · outcomes/priors | `GET /api/firm/outcomes` @assumed | `Outcome[]`, `priors[]` | |
| Outbound hold queue | `GET /api/outbound?status=holding` @assumed; Undo `POST /api/outbound/[id]/undo` @assumed; Send now `POST /api/outbound/[id]/send` @assumed | `OutboundItem[]` | `secondsLeft` = server `hold_until − now` |
| Decisions on Today cards | `POST /api/decisions` @assumed | — | approve → item enters hold queue |
| Pipeline stage move | `PATCH /api/deals/[id]` `{stage}` @assumed | — | `onMoveStage` reject → card returns |
| Journey stages | ✓ `FirmConfig.stages` | `Stage[]` | board columns = config stages |
| Claims & citations | in deal/memo payload @assumed | `SourceRef`, `cites: number[]` | each number has a source chip |
| Banking gates | `GET /api/mandates/[id]/gates` @assumed | `MandateGate[]` | nothing confidential until conflicts = cleared |
| Audit log (activity) | `GET /api/audit?deal=` @assumed | activity rows | every agent action + Undo |
| Slack/Teams card actions | Slack interactivity webhook @assumed | `SlackMessage` | verify the *clicker's* permission server-side |

## 5. Pixel checklist

Reference: `reference/<id>.png`, 1440×900 @1x, viewport. Open your route at the same size and compare (overlay at 50% or flip).

| Thing | Value |
|---|---|
| Fonts | Geist Sans (UI, `ss01`,`cv11`), Geist Mono (keys/ids), Newsreader Variable opsz (page titles, `.serif`, −0.012em) |
| Sidebar | 220px, `#f4f4f5`, right border zinc-200/70 |
| Top bar | 52px, sticky, `#fafafa/90` + blur |
| Page padding | `px-8` (32px), `pt-6` |
| Card | radius 12px, 1px `#e4e4e7`, shadow `0 1px 2px rgba(9,9,11,.04)` |
| Body text | 12.5–13px; eyebrow 10.5px uppercase .08em `#71717a` |
| Page title | Newsreader 28–30px |
| Accent | rust `#9c440f` only; ok `#3d6b4f`; warn `#8a5b12`; ink `#09090b`; canvas `#fafafa` |
| Table rows | 52–58px |
| Restricted card | 520px wide, dotgrid bg 14px |
| Settings | 3-col grid `220px · 1fr · 340px` (section nav · content · rail) |
| Onboarding | max-w 1120px, 1.25fr / 1fr grid; agent "working" card right |

| Route | Ref id(s) |
|---|---|
| /today | today, first-run, agent-run, command-k, command-k-denied, ask, ask-denied, hold-queue |
| /today?mode=bank | today-banking |
| /today?first=1&step=N | onboarding-1 … onboarding-5 |
| /pipeline | pipeline, pipeline-board, watchlist |
| /portfolio | portfolio |
| /mandates | mandates, mandates-gated |
| /deal | deal-page, deal-pinned, deal-team-open, deal-restricted |
| /deal/room | data-room |
| /memo | ic-memo, memo-priors |
| /brain | firm-brain |
| /settings | settings, settings-integrations, settings-members, settings-access, settings-export |
| /preview/slack | slack-preview |

Regenerate: `W=1440 H=900 DPR=1 FULL=0 OUT=port/reference node port/tools/shots.mjs` (edit its route map first).

## 6. Known deviations / notes

- Onboarding order is Firm → Mail & calendar → Thesis → Team → Approvals. The research (`inbound_workflow.md` §7) starts with mail; we put firm basics first so the agent has a website to pre-fill the thesis from while mail syncs. Swap via `steps` if you disagree.
- `/preview/slack` is a design reference for the Block Kit cards, not an app page.
- Watchlist: in `loading` the list skeletons but the right-hand intro panel keeps showing the last data (deliberate; it's a selection panel).
- Fixtures are realistic and coherent (NexaFlow, Halyard, Cobalt, Project Falcon …); they double as a demo seed.

## 7. v3 visual pass and Helio storyline states

**What changed visually.** The v2.1 IA, labels and one-primary-action rule are kept. v3 brings back v1's finish:
- `.card-raised` layered cards, number tiles, `.eyebrow-mark` and `.well`;
- TopBar on `#f8f8f7` with backdrop blur;
- every chart is hand-tuned SVG in `components/charts.tsx`: `BridgeChart`, `RangeChart` (new optional `stacked` for narrow rails), `RangeMini`, `RunwayChart`, `GrowthCompare`, `Funnel`, `Gauge` and `MiniBars`.

All SVG coordinates are rounded (`r2`) so SSR and client markup match.

**Prop changes.** All are optional additions, so nothing existing breaks:

| Type | New field | Used by |
|---|---|---|
| `TodayData` | `pulse?: PulseTile[]` | Pulse strip (4 tiles: bars / gauge / spark) |
| `Draft` | `preview?`, `basis?` | Draft rows show the first body line. `basis` goes in the title tooltip |
| `DecisionCard` | new union member `kind: "inboundFit"` | Today inbound card. If you `switch` on `kind` exhaustively, add a case |
| `DealData.section.growth?`, `MemoData.growth?` | `GrowthComparison` | Seed deals: deck 40% vs verified 22% (`GrowthCompare`) |
| `PortfolioPanel` | `onboarded?: {label, from[], at}` | "Filled from the deal" badge on a newly added company's runway |
| `PipelineBoardData` | `handoff?: PortfolioHandoff` | Board → Portfolio dock (phases `closed → moving → filling → done`) |
| `SlackMessage` | `reactions?`, `votes?`, `resolved?`, `thread?`, `metric?` | Claim confirmation, IC vote, milestone chart |
| `BrainData` | `thesis?: ThesisLine[]` | Firm thesis card. `state: "updating" \| "learned"` animates a line landing |

**Frames.** Each frame is a fixture function of `n`. The route remounts by `key` so the motion replays. With reduced motion, every frame is a clean still.

| State | Mockup route | Fixture | Ref PNG |
|---|---|---|---|
| Today with Helio inbound | `/today?inbound=1` | `todayWithInbound` | today-inbound |
| Deal · seed growth (40% vs 22%) | `/deal?id=helio` | `helioDeal` | deal-helio |
| IC memo · seed | `/memo?id=helio` | `helioMemo` | memo-helio |
| Portfolio · Helio just added | `/portfolio?company=helio` | `portfolioWithHelio` | portfolio-helio |
| Pipeline → Portfolio handoff 1–4 | `/pipeline?board=1&handoff=n` | `pipelineHandoff(n)` | handoff-1…4 |
| Slack · new inbound / claimed | `/slack`, `/slack?state=claim&frame=1\|2` | `slackDealflow`, `slackClaimed` | slack-dealflow, slack-claim-1/2 |
| Slack · IC vote 1–5 | `/slack?state=vote&frame=n` | `slackIcVoteFrame(n)` | slack-vote-1…5 |
| Slack · milestone | `/slack?state=milestone` | `slackMilestone` | slack-milestone |
| Brain · thesis learned 1–3 | `/brain?learned=n` | `brainLearnedFrame(n)` | brain-learned-1…3 |

Slack frames use `SlackStateScreen` (a full-window shell with `SlackWindow`). `/preview/slack` also lists the new cards.

## 8. v3.1 chart rebuild (shadcn charts / Recharts)

**New deps.** `recharts@3.8.0` and `tailwind-merge@3.7.0` (see `package.snippet.json`). No other runtime deps.

**New files.**
- `src/components/ui/chart.tsx`: the shadcn/ui chart primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`), unchanged API. If the app already has shadcn's `chart.tsx`, keep theirs and delete this one; the imports match.
- `src/lib/utils.ts`: `cn()`.
- `src/components/brainviz.tsx`: Firm brain charts (`MemoryGrowth`, `Composition`, `PassReasons`, `OutcomeScore`, `PriorViz`).
- `globals.css`: chart tokens (`--color-chart-*`, shadcn `--color-background/foreground/border/muted`) and two classes (`.dd-chart` sets tabular numbers and axis type; `.dd-tip` is the rich tooltip card).

**Chart mapping.** All component names and props in `charts.tsx` are unchanged, so call sites don't change.

| Chart | Where | Library | Why |
|---|---|---|---|
| `BridgeChart` (ARR bridge) | Today card, Deal, IC memo fig. 1 | shadcn/Recharts `BarChart` (stacked invisible base + delta) | The waterfall is a stacked bar. Recharts gives the axis, grid, tooltip and animation. Brackets, connectors and the ghost bar are custom layers (`usePlotArea`/axis-scale hooks) |
| `GrowthCompare` (deck 40% vs verified 22%) | Deal · Helio, Memo · Helio | Recharts `ComposedChart` (2 gradient areas + hatched gap) and `BarChart` (MoM with claimed/avg reference lines) | Two curves plus the gap need a shared scale, reference lines and a tooltip, which is Recharts' core |
| `RangeChart` (football field) | IC memo fig. 2, Deal valuation | Recharts vertical `BarChart` of [low, high] ranges | A dumbbell/range bar (21st.dev pattern) with cap and ask reference lines, a hatched overpay band and haloed value labels |
| `RunwayChart` | Portfolio rail, Portfolio · Helio | Recharts `ComposedChart` (area + line) | Gradient area, a 9-month `ReferenceLine` alert band, a dashed projection and a latest-point callout |
| `Funnel` | Pipeline | Recharts `BarChart` (stacked kept + dropped) | Counts sit above the bars, "% of sourced" sits under each stage, and every conversion pill is shown against the firm average (the 21st.dev funnel pattern) |
| `MiniBars`, `Spark` → `SparkArea` | Pulse tiles, Portfolio rows, brain usage | Recharts (tiny, no axes) | The same tokens, gradient and end dot everywhere. `Spark` keeps its props and delegates to `SparkArea` |
| `MemoryGrowth`, `PassReasons` | Firm brain | Recharts | Area chart with a "+N this week" end pill, and pill bars with a right-aligned count and share column |
| `Composition`, `OutcomeScore`, `PriorViz` | Firm brain | framer-motion + divs | Partition bars and meters: these are layout, not plots, so a chart library adds nothing |
| `Gauge`, `RangeMini` | Pulse IC tile, deal header | Hand-tuned SVG (kept) | Tiny fixed-size glyphs. Recharts' radial chart was heavier and looked worse at 56 px |

**Rejected.**
- **Tremor:** couples to Tailwind v3 config. Tremor Raw is Recharts underneath anyway.
- **visx:** too low-level for the gain.
- **Nivo:** heavy, and it has its own theming system.
- **21st.dev registry:** needs an API key (403). Its funnel, dumbbell and stats-card patterns were reimplemented on Recharts instead.

**SSR note.** Recharts 3 renders its SVG on the client after measuring. On the server you get the sized wrapper (`ChartContainer` uses `initialDimension`), so there is no layout shift. The render test checks the wrapper and labels, not the SVG paths.

**Prop additions (all optional).**

| Type | New field | Used by |
|---|---|---|
| `PulseTile` | `delta?: {label, tone?: "ok"\|"rust"\|"neutral"}` | Delta chip after the value ("+4 wk", "−0.8 mo") |
| `BrainData` | `trendLabels?: string[]` | Month axis on `MemoryGrowth` |
| `BrainData` | `usage?: {reads[], days?, delta, cited, stale}` | "Read by agents · 7 days" card in the brain rail |

**Fixes.**
- Brain learned frame 3 shows 1,285 everywhere: nav, hero, composition and trend end.
- Board Term sheet count after the handoff is 0, with a "Drop here" state.
- Portfolio runway "8.4 mo" no longer wraps.
- Funnel adds Partner meeting → Due diligence (58% vs firm 52%). The only below-average step (DD → IC 55% vs 60%) is labelled "below firm 60%".

Before/after: `review/compare_v3_1/*.jpg` (v1 | v3 | v3.1, 1440×900) and `review/compare_v3_1/charts/` (v3 | v3.1 close-ups).

## 9. v3.2 declutter, calm Today, Agent page, assistant dock

> **Review build. Do not hand this bundle to build_os until Saurabh approves the v3.2 mockups.**

**Declutter rules applied everywhere.** One title plus at most one quiet meta item per header; everything else moved into a tooltip (`title`), an info popover or an icon menu. Actions are single lucide icon buttons with tooltips; clicking opens a menu. Tables were **not** restructured: same columns, status pills, source chips and content. Only padding, header↔cell alignment, left-aligned text, right-aligned tabular numbers, row height and truncation changed.

**New UI primitives (`components/ui.tsx`).**
- `IconBtn({icon, label, size?, tone?: "ghost"|"primary"|"bare", active?, href?, onClick?})`: 32/28 px square icon button. `label` is both `aria-label` and the tooltip.
- `IconMenu({icon, label, title?, items?, children?, w?, align?, tone?, defaultOpen?})`: icon button with `aria-haspopup="menu"` that opens a popover. Pass `items` (`{id, label, icon?, hint?, onSelect?}` rendered as `role="menuitem"`) or free `children` (e.g. `DetailRows`). Closes on outside click and Esc. It has no `aria-controls`, so the interact check still finds `SrcPop` first on /deal.
- `DetailRows({rows: {k, v}[]})`: key/value list used inside popovers.

**Changed components (all new props optional, old call sites still compile).**

| Where | Change |
|---|---|
| `WallBadge` | `iconOnly?` renders the lock alone with the label as its tooltip |
| `Pipeline Head` | `views?`, `onView?`, `info?`, `layout?`: View dropdown → `ListFilter` menu; Export → `Download` menu; Add deal → icon |
| `settings Card` | `meta?` (quiet right-side text); `sub` now goes to the title tooltip |
| `TopBar` | the back-link replaces a crumb trail that would only repeat the page title; the ask bar label is `Ask about <ctx>` |
| `DealHead` | stage pill, files ring, red flags and cap range move into one meta line plus an `Info` popover; primary actions are icon buttons |
| Export buttons (Portfolio, Pipeline, Mandates, Memo, Brain, Access audit) | single `Download` `IconMenu` with the formats as items |
| `SlackMsg` | the per-message footer is now the timestamp's `title`; votes read "N of M partners" |
| `OutboundCard` | hold note → `Lock` + "5 min" with the rule as its title |
| `OnboardingScreen` | removed the step Ring (the stepper already shows it); read-only footer → `Lock` icon |
| `RunPanel` | removed the "Esc close" hint |

**Shell.**
- `Nav` gains `"agents"`; the sidebar is grouped: Today, then **Deals** (Pipeline, Portfolio or Mandates), then **Intelligence** (Agents with a live count, Firm brain). The bottom "N agents working" row and the "Firm" tag on Settings are gone.
- `Page` gains `dock?: ReactNode` (sticky 360 px right aside, white, left border) and `tone?: "warm" | "mono"` (adds `.mono`).
- `ROUTES.agents = "/agent"`, `ROUTES.agent(id, view?)`.

**New files.**
- `components/assistant.tsx`: `AssistantDock({data: AssistantData, onSuggestion?, onSend?, onClose?})`. Chat (user bubbles plus agent text with `Src` chips), suggestion cards and one input with a black send button.
- `screens/todaycalm.tsx`: `TodayCalmScreen({shell, data: TodayCalmData, assistant?, tone?, overlay?, onSuggestion?})`. A greeting, 4 `CalmStat` cards with a "View …" footer link, one `DealFlowChart` and one recent-decisions list. Route: `/today?layout=calm[&tone=mono]`. Classic `/today` is unchanged and stays the default until approval.
- `screens/agent.tsx`: `AgentScreen({shell, data: AgentData, assistant?, view?: "steps"|"flow", run?: AgentRunState, autoplay?, tone?, onView?, onRun?})`.
  - Steps view: trigger card, numbered steps on a hairline connector (icon, title, one line, toggle, … menu), rust issues pill only on the step that has one.
  - Flow view: dotted-grid canvas (`flow.nodes` x/y, 200×96 nodes), dashed bezier edges, tiny edge labels, a glowing dot on edges into the running node.
  - Motion: running title shimmers (`.shimmer .shimmer-ink`), the dot travels the connector, finished steps spring in with a drawn check. `prefers-reduced-motion` stops autoplay.
  - `run` freezes a moment. `agentRunAt(frame)` maps `?frame=1…13` (`AGENT_FRAMES`): odd = step (f+1)/2 running, even = hand-off with the dot halfway. Omit `run` for the autoplay loop.
  - Route: `/agent[?view=flow][&frame=N][&tone=mono][&dock=0]`.
- `fixtures/agents.ts`: `helioAgent`, `helioAgentRun`, `agentRunAt`, `AGENT_FRAMES`, `helioAssistant`, `todayAssistant`, `todayCalm`.
- `charts.tsx`: `DealFlowChart({weeks, read, worth, h?, mono?})`. Soft bars for decks read, an ink line for "worth a look" with an end pill, and the shared `TipCard` tooltip.

**New types (`types.ts`).** `Tone2`, `AgentStepIcon`, `AgentStepState`, `AgentStep` (`short?` for the flow canvas, `issues?`, `result?`, `approval?`), `AgentFlowNode`, `AgentFlowEdge`, `AgentData`, `AgentRunState`, `AssistantMsg`, `AssistantSuggestion`, `AssistantData`, `CalmStat`, `CalmActivity`, `TodayCalmData`.

**CSS (`globals.css`, appended).** `.shimmer`, `.shimmer-ink`, `.shimmer-frozen` (paused mid-sweep for screenshots), `.dot-grid`, `.dash-flow`, `.glow-warm` / `.glow-mono` / `.glow-sienna` (the running colour: muted green, ink, or sienna on Today), `.shimmer-sienna`, `.mono` (sienna → ink, serif → sans 500, cooler off-white).

**Endpoints to wire.** `AgentData` ← agent definition plus the latest run (`GET /agents/:id`, `GET /runs/:id`); `AgentRunState` ← run progress events (SSE); step toggles → `PATCH /agents/:id/steps/:stepId {on}`; `AssistantData` ← `POST /ask` with page context; `TodayCalmData.chart` ← weekly counts of decks read and marked worth a look.

**Checks.** `tsc` clean; render test 114/114 (adds calm Today warm/mono, Agent steps/flow × warm/mono, autoplay without dock, and all 13 frames × 2 views); interact check adds the step … menu, toggle, view switch and the autoplay advancing.

**References.** `reference/today-calm*.png`, `reference/agent*.png`, `reference/agent-frames/agent-frame-N.png` and `agent-flow-frame-N.png`. Before/after: `review/compare_v3_2/`. Video: `review/compare_v3_2/agent_run_steps.mp4`, `agent_run_flow.mp4`, `agent_run_steps.gif`.
