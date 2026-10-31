/**
 * Smoke render of every screen + variant with its fixtures (server render, no browser).
 * Run: npx tsx --tsconfig port/tsconfig.json port/test/render.test.tsx
 * Exits non-zero if any screen throws or renders an empty string.
 */
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import { TodayScreen } from "../src/screens/today";
import { OnboardingScreen } from "../src/screens/onboarding";
import { PipelineTableScreen, PipelineBoardScreen, WatchlistScreen } from "../src/screens/pipeline";
import { PortfolioScreen } from "../src/screens/portfolio";
import { MandatesScreen } from "../src/screens/mandates";
import { DealScreen, RestrictedDealScreen } from "../src/screens/deal";
import { DataRoomScreen } from "../src/screens/dataroom";
import { MemoScreen } from "../src/screens/memo";
import { helioMemoDoc } from "../src/fixtures/heliomemo";
import { BrainScreen } from "../src/screens/brain";
import { SettingsScreen } from "../src/screens/settings";
import { SlackPreviewScreen, SlackStateScreen } from "../src/screens/slackpreview";
import { RunPanel, CommandPalette, AskPanel } from "../src/components/overlays";
import { TodayCalmScreen } from "../src/screens/todaycalm";
import { AgentScreen } from "../src/screens/agent";
import { AgentFlowScreen } from "../src/screens/agentflow";
import { flowFrameMs, flowTotal, flowRunAt } from "../src/components/flowcanvas";
import { TodaySummaryScreen } from "../src/screens/todaysummary";
import { AskFullScreen } from "../src/screens/askfull";
import { AssistantDock } from "../src/components/assistant";
import { AssistantHost } from "../src/components/askctx";
import { PersonScreen } from "../src/screens/person";
import { BookCall } from "../src/components/meeting";
import { ConnectModal, ConnectChip } from "../src/components/connect";
import { AgentsScreen } from "../src/screens/agents";
import { LandingScreen } from "../src/screens/landing";
import * as F from "../src/fixtures";
import type { LoadStatus, SettingsSection } from "../src/types";

const cases: [string, ReactElement][] = [];
const add = (n: string, el: ReactElement) => cases.push([n, el]);
const statuses: LoadStatus[] = ["loading", "error"];

add("today/invest", <TodayScreen shell={F.shellInvest} data={F.todayInvest} />);
add("today/summary", <TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} />);
add("today/summary-empty", <TodaySummaryScreen shell={F.shellInvest} data={{ ...F.todaySummary, rows: [] }} status="empty" />);
add("today/summary-waiting", <TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} waiting={{ w1: "calendar" }} />);
// v4 · meeting modal (?meet=1, ?conflict=1) and the just-in-time connect (?connect=<tool>), every state, every tool
for (const st of ["edit", "conflict", "sending", "sent"] as const) add(`modal/bookcall-${st}`, <BookCall d={F.keelCall} state={st} />);
add("modal/bookcall-no-conflict-data", <BookCall d={{ ...F.keelCall, conflict: undefined, fitScore: undefined, round: undefined }} state="conflict" />);
for (const [id, ask] of Object.entries(F.connectAsks)) for (const st of ["ask", "connecting", "connected"] as const) add(`modal/connect-${id}-${st}`, <ConnectModal ask={ask} state={st} />);
for (const t of ["calendar", "gmail", "slack"] as const) add(`chip/connect-${t}`, <ConnectChip tool={t} />);
add("today/summary-waiting-gmail", <TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} waiting={{ w1: "gmail" }} />);
add("today/bank", <TodayScreen shell={F.shellBank} data={F.todayBank} />);
add("today/hold-queue", <TodayScreen shell={F.shellInvest} data={F.todayInvestHolding} holdMinutes={5} tick={false} />);
add("today/agent-run", <TodayScreen shell={F.shellInvest} data={F.todayInvest} overlay={<RunPanel run={F.agentRun} />} />);
add("today/cmdk", <TodayScreen shell={F.shellInvest} data={F.todayInvest} overlay={<CommandPalette data={F.palette} />} />);
add("today/cmdk-denied", <TodayScreen shell={F.shellInvest} data={F.todayInvest} overlay={<CommandPalette data={F.paletteDenied} />} />);
add("today/ask", <TodayScreen shell={F.shellInvest} data={F.todayInvest} overlay={<AskPanel data={F.askAnswer} />} />);
add("today/ask-denied", <TodayScreen shell={F.shellInvest} data={F.todayInvest} overlay={<AskPanel data={F.askDenied} />} />);
for (const s of [1, 2, 3, 4, 5] as const) add(`onboarding/step-${s}`, <OnboardingScreen shell={F.shellFirstRun} data={F.onboarding(s)} slackPreview={F.slackHoldApproval} />);
for (const tone of ["warm", "mono"] as const) {
  add(`today-calm/${tone}`, <TodayCalmScreen shell={F.shellInvest} data={F.todayCalm} assistant={F.todayAssistant} tone={tone} />);
  for (const view of ["steps", "flow"] as const) add(`agent/${view}/${tone}`, <AgentScreen shell={F.shellInvest} data={F.helioAgent} assistant={F.helioAssistant} view={view} tone={tone} run={F.helioAgentRun} />);
}
for (const [k, fl] of Object.entries(F.agentFlows)) {
  add(`agentflow/${k}`, <AgentFlowScreen shell={F.shellInvest} data={fl} />);
  add(`agentflow/${k}/run`, <AgentFlowScreen shell={F.shellInvest} data={fl} autoplay />);
  add(`agentflow/${k}/guardrails`, <AgentFlowScreen shell={F.shellInvest} data={fl} modal />);
  for (const n of fl.nodes) add(`agentflow/${k}/node-${n.id}`, <AgentFlowScreen shell={F.shellInvest} data={fl} node={n.id} />);
  for (let f = 1; f <= fl.run.events.length + 1; f++) add(`agentflow/${k}/frame-${f}`, <AgentFlowScreen shell={F.shellInvest} data={fl} frozenMs={flowFrameMs(fl, f)} />);
  for (const st of [...statuses, "empty" as const]) add(`agentflow/${k}/${st}`, <AgentFlowScreen shell={F.shellInvest} data={fl} status={st} />);
  if (!flowRunAt(fl, flowTotal(fl)).complete) throw new Error(`agentflow/${k}: run never completes`);
}
for (const p of Object.values(F.people)) {
  for (const tab of ["activity", "emails", "meetings", "notes", "files"] as const) add(`person/${p.id}/${tab}`, <PersonScreen shell={F.shellInvest} data={p} tab={tab} />);
  for (const st of [...statuses, "empty" as const]) add(`person/${p.id}/${st}`, <PersonScreen shell={F.shellInvest} data={p} status={st} />);
}
add("person/no-events", <PersonScreen shell={F.shellInvest} data={{ ...F.personAnanya, groups: [] }} />);
add("person/alias-alex-rao", <PersonScreen shell={F.shellInvest} data={F.personById("alex-rao")} />);
for (const p of Object.values(F.people)) for (const id of [p.queue.prevId, p.queue.nextId]) if (id && !F.people[id]) throw new Error(`person/${p.id}: queue points at missing ${id}`);
{ // the run's deal must match the pipeline and Today's work list
  const dl = F.inboundFlow.run.deal!, pd = F.pipelineDeals.find((x) => x.id === dl.id), wr = F.workRows.find((x) => x.company.id === dl.id);
  if (!pd || Math.round(pd.thesisFit * 100) !== dl.fit || wr?.fit.score !== dl.fit) throw new Error("agentflow: run fit differs from Pipeline/Today");
}
add("agentflow/no-nodes", <AgentFlowScreen shell={F.shellInvest} data={{ ...F.inboundFlow, nodes: [], edges: [] }} />);
add("agent/autoplay-no-dock", <AgentScreen shell={F.shellInvest} data={F.helioAgent} />);
for (let f = 1; f <= F.AGENT_FRAMES; f++) for (const view of ["steps", "flow"] as const) add(`agent/frame-${f}/${view}`, <AgentScreen shell={F.shellInvest} data={F.helioAgent} view={view} run={F.agentRunAt(f)} />);
add("pipeline/table", <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} />);
add("pipeline/table-diligence", <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} filter="diligence" />);
add("pipeline/table-search", <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} query="leo" />);
add("pipeline/table-selected", <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} selected={["keel", "ledgerly"]} />);
add("pipeline/table-nomatch", <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} query="zzz" />);
add("pipeline/board", <PipelineBoardScreen shell={F.shellInvest} data={F.pipelineBoard} onMoveStage={() => {}} />);
add("agents/list", <AgentsScreen shell={F.shellInvest} data={F.agentsList} />);
add("agents/runs", <AgentsScreen shell={F.shellInvest} data={F.agentsList} tab="runs" />);
add("agents/runs-waiting", <AgentsScreen shell={F.shellInvest} data={F.agentsList} tab="runs" runFilter="waiting" />);
add("agents/status-attention", <AgentsScreen shell={F.shellInvest} data={F.agentsList} statusFilter="attention" />);
add("agents/search", <AgentsScreen shell={F.shellInvest} data={F.agentsList} query="crustdata" />);
add("agents/nomatch", <AgentsScreen shell={F.shellInvest} data={F.agentsList} query="zzz" />);
add("agents/open-diligence", <AgentsScreen shell={F.shellInvest} data={F.agentsList} open="diligence" />);
add("agents/empty", <AgentsScreen shell={F.shellInvest} data={{ ...F.agentsList, agents: [], runs: [] }} status="empty" />);
add("pipeline/watchlist", <WatchlistScreen shell={F.shellInvest} data={F.watchlist} />);
add("portfolio", <PortfolioScreen shell={F.shellInvest} data={F.portfolio} />);
add("mandates/halyard", <MandatesScreen shell={F.shellBank} data={F.mandateHalyard} />);
add("mandates/cobalt-gated", <MandatesScreen shell={F.shellBank} data={F.mandateCobalt} />);
add("deal", <DealScreen shell={F.shellInvest} data={F.deal} />);
add("deal/pinned", <DealScreen shell={F.shellInvest} data={F.deal} pinSources />);
add("deal/team-open", <DealScreen shell={F.shellInvest} data={F.dealTeamOpenVariant} />);
add("deal/restricted", <RestrictedDealScreen shell={F.shellInvest} data={F.restrictedDeal} channel="#deal-falcon" />);
add("deal/room", <DataRoomScreen shell={F.shellInvest} data={F.dataRoom} />);
add("deal/room-walled", <DataRoomScreen shell={F.shellInvest} data={F.dataRoom} walled />);
add("memo", <MemoScreen shell={F.shellInvest} data={F.memo} />);
add("memo/no-priors", <MemoScreen shell={F.shellInvest} data={{ ...F.memo, priors: undefined }} />);
add("brain", <BrainScreen shell={F.shellInvest} data={F.brain} />);
add("brain/empty", <BrainScreen shell={F.shellInvest} data={F.brainEmptyMemories} />);
for (const s of ["workflow", "connectors", "integrations", "members", "access", "export"] as SettingsSection[]) {
  add(`settings/${s}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section={s} />);
  add(`settings/${s}-member`, <SettingsScreen shell={F.shellInvest} data={F.settingsMember} section={s} />);
}
for (const tab of ["connected", "attention", "available"] as const) add(`settings/connectors/tab-${tab}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" connectorsView={{ tab }} />);
for (const c of F.connectors.categories) add(`settings/connectors/cat-${c.id}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" connectorsView={{ category: c.id }} />);
add("settings/connectors/search-empty", <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" connectorsView={{ q: "bloomberg" }} />);
add("settings/connectors/empty", <SettingsScreen shell={F.shellInvest} data={{ ...F.settings, connectors: { ...F.connectors, items: [] } }} section="connectors" status="empty" />);
for (const id of ["crustdata", "gmail", "model", "agentmail", "slack"]) add(`settings/connectors/manage-${id}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" connectorsView={{ manage: id }} />);
for (const id of ["fireflies", "affinity", "model"]) add(`settings/connectors/connect-${id}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" connectorsView={{ connect: id }} />);
{ // fixture rule: only tier "core" may be connected / need attention
  const bad = F.connectors.items.filter((c) => c.tier === "available" && c.status !== "available");
  if (bad.length) throw new Error(`connectors: tier (b) not available: ${bad.map((c) => c.id).join(", ")}`);
}
add("preview/slack", <SlackPreviewScreen channels={F.slackPreviewChannels} />);
// v3 · Helio storyline states (each frame is a fixture function of n)
add("today/inbound", <TodayScreen shell={F.shellInvest} data={F.todayWithInbound} tick={false} />);
add("deal/helio", <DealScreen shell={F.shellInvest} data={F.helioDeal} />);
// v4 · Signals (Crustdata signal graph + live research): final state, every ?graph= frame, and its own load states
// v4 · deal page round 1: every outline section, alert states, reviewer added, Helio data room at a file, states
for (const id of Object.keys(F.helioSections)) add(`deal/helio-${id}`, <DealScreen shell={F.shellInvest} data={F.helioDealSignals} view={id} />);
add("deal/helio-alert-sheet", <DealScreen shell={F.shellInvest} data={F.helioDealSignals} alertInit={{ sheet: true }} />);
add("deal/helio-alert-done", <DealScreen shell={F.shellInvest} data={F.helioDealSignals} alertInit={{ saved: true, requested: true }} reviewerAdded askAdded />);
for (const st of ["loading", "error"] as const) add(`deal/helio-${st}`, <DealScreen shell={F.shellInvest} data={F.helioDealSignals} status={st} error="Couldn't load" onRetry={() => {}} />);
for (const f of F.helioRoomFiles) add(`deal/room-helio-${f}`, <DataRoomScreen shell={F.shellInvest} data={F.helioRoom(f)} />);
{ // Helio reads the same everywhere: Today's row, the deal header, the meeting invite and the person page
  const row = F.workRows.find((r) => r.company.id === "helio")!, h = F.helioDeal.header;
  if (row.fit.score !== h.fit?.score || row.owner?.initials !== h.owner?.initials) throw new Error("Helio fit/owner differ between Today and the deal page");
  if (F.helioDeal.team.members.find((m) => m.role === "lead")?.initials !== row.owner?.initials) throw new Error("Helio deal-team lead differs from Today's owner");
  const emails = [F.helioAlert.verify.draft.to.email, ...F.nextMeetings.filter((m) => m.company?.id === "helio").map((m) => m.founder?.email)];
  if (emails.some((e) => e !== F.helioFounder.email)) throw new Error(`Ananya's email differs: ${emails.join(", ")}`);
}
add("deal/signals", <DealScreen shell={F.shellInvest} data={F.helioDealSignals} view="signals" />);
F.helioSignals.frames.forEach((at, i) => add(`deal/signals-frame-${i}`, <DealScreen shell={F.shellInvest} data={F.helioDealSignals} view="signals" signalsAt={at} />));
for (const st of ["loading", "empty", "error"] as const) add(`deal/signals-${st}`, <DealScreen shell={F.shellInvest} data={F.helioDealSignals} view="signals" signalsStatus={st} error="Crustdata timed out" onRetry={() => {}} />);
add("memo/helio", <MemoScreen shell={F.shellInvest} data={F.helioMemo} />);
// v4 · IC memo round 1: document-first memo, its interaction frames and states; numbers must tie to the deal page and Today
add("memo/helio-doc", <MemoScreen shell={F.shellInvest} data={helioMemoDoc} />);
add("memo/helio-share", <MemoScreen shell={F.shellInvest} data={helioMemoDoc} initial={{ share: true }} />);
add("memo/helio-edit", <MemoScreen shell={F.shellInvest} data={helioMemoDoc} initial={{ edit: "diligence" }} />);
add("memo/helio-override-off", <MemoScreen shell={F.shellInvest} data={helioMemoDoc} initial={{ override: false, cite: 4 }} />);
add("memo/helio-vote-queued", <MemoScreen shell={F.shellInvest} data={helioMemoDoc} initial={{ vote: true, queued: true }} />);
for (const st of ["loading", "empty", "error"] as const) add(`memo/helio-${st}`, <MemoScreen shell={F.shellInvest} data={helioMemoDoc} status={st} error="Couldn't load" onRetry={() => {}} />);
{
  const doc = helioMemoDoc.doc!, h = F.helioDeal.header, text = JSON.stringify(doc.sections);
  const row = F.workRows.find((r) => r.company.id === "helio")!;
  if (doc.fit.score !== h.fit?.score || doc.fit.score !== row.fit.score) throw new Error("Memo fit differs from the deal page / Today");
  if (doc.author.name !== h.owner?.name) throw new Error("Memo author differs from the deal owner");
  if (!h.icLabel.includes(doc.ic.when)) throw new Error(`Memo IC time "${doc.ic.when}" differs from the deal header "${h.icLabel}"`);
  for (const must of ["$65K", "$113K", "$48K", "22% a month", "40%", "$1.5M seed", "$500K", "Ananya Rao"]) if (!text.includes(must)) throw new Error(`Memo is missing "${must}"`);
  const cites = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const missing = cites.filter((n) => !doc.sources.some((s) => s.n === n));
  if (missing.length) throw new Error(`Memo cites unknown sources: ${missing.join(", ")}`);
  if (doc.sections.some((s) => !s.blocks.length)) throw new Error("Memo has an empty section");
  if (doc.sections.some((s) => s.state === "warn" && !s.review)) throw new Error("Amber memo section without a review item");
}
add("portfolio/helio", <PortfolioScreen shell={F.shellInvest} data={F.portfolioWithHelio} />);
for (const n of [1, 2, 3, 4]) add(`pipeline/handoff-${n}`, <PipelineBoardScreen shell={F.shellInvest} data={F.pipelineHandoff(n)} />);
for (const n of [1, 2, 3]) add(`brain/learned-${n}`, <BrainScreen shell={F.shellInvest} data={F.brainLearnedFrame(n)} />);
add("slack/dealflow", <SlackStateScreen channel="#dealflow" caption="New inbound" messages={[F.slackDealflow]} />);
add("slack/claimed", <SlackStateScreen channel="#dealflow" caption="Claimed" frame={{ n: 2, of: 2 }} messages={F.slackClaimed} />);
for (const n of [1, 2, 3, 4, 5]) add(`slack/vote-${n}`, <SlackStateScreen channel="#ic" caption="IC vote" frame={{ n, of: 5 }} messages={F.slackIcVoteFrame(n)} />);
add("slack/milestone", <SlackStateScreen channel="#portfolio" caption="Milestone" messages={[F.slackMilestone]} />);
// v3.3 · assistant: full page frames 1–6 (today + deal), states, and the dock open on Today at each frame
for (let f = 1; f <= F.ASSISTANT_FRAMES; f++) {
  add(`ask/today-${f}`, <AskFullScreen shell={F.shellInvest} data={F.assistantAt(f, F.askFull)} back={{ label: "Back to Today", href: "/today" }} />);
  add(`ask/deal-${f}`, <AskFullScreen shell={F.shellInvest} data={F.assistantAt(f, F.helioAskEmpty)} back={{ label: "Back to Helio Sensors", href: "/deal?id=helio" }} />);
  add(`today-summary/dock-${f}`, <AssistantHost dock={<AssistantDock data={F.assistantAt(f, F.askByPage.today)} />}><TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} /></AssistantHost>);
}
add("ask/empty", <AskFullScreen shell={F.shellInvest} data={F.assistantAt(4, F.askFull)} status="empty" />);
add("today-summary/dock-pagedefault", <AssistantHost><TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} /></AssistantHost>);
// loading / error states for every data screen
for (const st of statuses) {
  add(`today/${st}`, <TodayScreen shell={F.shellInvest} data={F.todayInvest} status={st} error="Couldn't load" onRetry={() => {}} />);
  add(`today-summary/${st}`, <TodaySummaryScreen shell={F.shellInvest} data={F.todaySummary} status={st} error="Couldn't load" />);
  add(`ask/${st}`, <AskFullScreen shell={F.shellInvest} data={F.askFull} status={st} error="Couldn't load" onRetry={() => {}} />);
  add(`agents/${st}`, <AgentsScreen shell={F.shellInvest} data={F.agentsList} status={st} error="Couldn't load" />);
  add(`pipeline/${st}`, <PipelineTableScreen shell={F.shellInvest} data={F.pipelineTable} status={st} error="Couldn't load" />);
  add(`board/${st}`, <PipelineBoardScreen shell={F.shellInvest} data={F.pipelineBoard} status={st} error="Couldn't load" />);
  add(`watchlist/${st}`, <WatchlistScreen shell={F.shellInvest} data={F.watchlist} status={st} error="Couldn't load" />);
  add(`portfolio/${st}`, <PortfolioScreen shell={F.shellInvest} data={F.portfolio} status={st} error="Couldn't load" />);
  add(`mandates/${st}`, <MandatesScreen shell={F.shellBank} data={F.mandateHalyard} status={st} error="Couldn't load" />);
  add(`deal/${st}`, <DealScreen shell={F.shellInvest} data={F.deal} status={st} error="Couldn't load" />);
  add(`room/${st}`, <DataRoomScreen shell={F.shellInvest} data={F.dataRoom} status={st} error="Couldn't load" />);
  add(`memo/${st}`, <MemoScreen shell={F.shellInvest} data={F.memo} status={st} error="Couldn't load" />);
  add(`brain/${st}`, <BrainScreen shell={F.shellInvest} data={F.brain} status={st} error="Couldn't load" />);
  add(`settings/${st}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="workflow" status={st} error="Couldn't load" />);
  add(`settings/connectors/${st}`, <SettingsScreen shell={F.shellInvest} data={F.settings} section="connectors" status={st} error="Couldn't load" />);
}

// v4 · landing page: every question, demo frame, sent state, still frame, states
for (const q of F.landing.assistant.questions) add(`landing/q-${q.id}`, <LandingScreen data={F.landing} question={q.id} still />);
add("landing/ready", <LandingScreen data={F.landing} />);
add("landing/demo", <LandingScreen data={F.landing} demoOpen still />);
add("landing/requested", <LandingScreen data={F.landing} requested="saurabh@northbeam.vc" />);
add("landing/empty", <LandingScreen data={{ ...F.landing, features: { ...F.landing.features, items: [] } }} status="empty" />);
for (const st of statuses) add(`landing/${st}`, <LandingScreen data={F.landing} status={st} error="Couldn't load" />);

// v4 · Portfolio + Firm brain round 1: one Fund III story across shell, portfolio, brain and the inbound agent
add("portfolio/no-companies", <PortfolioScreen shell={F.shellInvest} data={{ ...F.portfolio, companies: [] }} />);
add("portfolio/status-empty", <PortfolioScreen shell={F.shellInvest} data={F.portfolio} status="empty" />);
add("brain/status-empty", <BrainScreen shell={F.shellInvest} data={F.brain} status="empty" />);
add("brain/no-proposals", <BrainScreen shell={F.shellInvest} data={{ ...F.brain, proposals: [] }} />);
{
  const pf = F.portfolio, br = F.brain, sh = F.shellInvest, firm = sh.firm!;
  if (!firm.sub.startsWith(pf.fundLabel + " ")) throw new Error(`Portfolio fund "${pf.fundLabel}" differs from the shell "${firm.sub}"`);
  if (pf.companies.length !== pf.companyCount) throw new Error("Portfolio companyCount differs from its rows");
  const kpi = pf.reports.find((r) => r.kind === "kpiRequests");
  if (kpi && kpi.kind === "kpiRequests" && kpi.total !== pf.companies.length) throw new Error("KPI requests total differs from the company count");
  if (pf.hiddenOnTrack !== pf.companies.filter((c) => c.onTrack).length) throw new Error("hiddenOnTrack differs from on-track rows");
  const need = pf.companies.filter((c) => c.alert && c.alert.tone !== "ok").length;
  if (sh.badges.portfolio?.count !== need) throw new Error(`Sidebar Portfolio badge ${sh.badges.portfolio?.count} ≠ ${need} needing attention`);
  const stage = firm.sub.split(" · ")[1];
  if (!br.thesis?.find((l) => l.field === "Stage")?.text.startsWith(stage)) throw new Error(`Thesis stage differs from the shell "${stage}"`);
  if (!br.thesis?.find((l) => l.field === "Check size")?.text.includes("$2M")) throw new Error("Thesis cheque differs from the agent's Cheque ≤ $2M");
  for (const k of br.kinds) if (k.id !== "all" && !br.memories.some((m) => m.kindId === k.id)) throw new Error(`Memory category "${k.label}" has no memories`);
  const sum = br.kinds.filter((k) => k.id !== "all").reduce((a, k) => a + Number(k.count.replace(/,/g, "")), 0);
  if (sum !== br.total) throw new Error(`Memory categories sum to ${sum}, total is ${br.total}`);
}

let fail = 0;
const origError = console.error; const warnings: string[] = [];
console.error = (...a: unknown[]) => { warnings.push(String(a[0]).slice(0, 160)); };
for (const [name, el] of cases) {
  try {
    const html = renderToString(el);
    if (html.length < 200) throw new Error(`suspiciously small render (${html.length} chars)`);
    process.stdout.write(`ok   ${name.padEnd(28)} ${String(html.length).padStart(7)} chars\n`);
  } catch (e) { fail++; process.stdout.write(`FAIL ${name}: ${(e as Error).message}\n`); }
}
console.error = origError;
const uniq = [...new Set(warnings)];
if (uniq.length) console.log(`\nReact warnings (${uniq.length} unique):\n` + uniq.map((w) => "  - " + w).join("\n"));
console.log(`\n${cases.length - fail}/${cases.length} renders passed`);
process.exit(fail ? 1 : 0);
