"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { TodayScreen } from "@port/screens/today";
import { TodayCalmScreen } from "@port/screens/todaycalm";
import { TodaySummaryScreen } from "@port/screens/todaysummary";
import { BookFlow, useBookFlow, bookFrame, useConnectFlow, ConnectFlow } from "@port/components/bookflow";
import { MeetingPanel } from "@port/components/meeting";
import { OnboardingScreen } from "@port/screens/onboarding";
import { AssistantHost } from "@port/components/askctx";
import { AssistantDock } from "@port/components/assistant";
import { RunPanel, CommandPalette, AskPanel } from "@port/components/overlays";
import { askByPage, shellInvest, shellBank, shellFirstRun, todayInvest, todayBank, todayInvestHolding, todayWithInbound, agentRun, palette, paletteDenied, askAnswer, askDenied, onboarding, slackHoldApproval, todayCalm, todayAssistant, assistantAt, todaySummary, keelCall, calendarAsk, connectAsks, nextMeetings } from "@port/fixtures";
import type { OnboardingData, WorkRow } from "@port/types";
import { usePipelineDeals } from "@/live/usePipelineDeals";
import { realPipelineDeals } from "@/lib/adapters/today";
import { useDataMode } from "@/components/datamode";
import { LiveTodaySummary } from "@/live/todaySummary";
import { liveShellFrom } from "@/live/shell";

type Q = { first?: string; step?: string; run?: string; k?: string; denied?: string; ask?: string; hold?: string; mode?: string; tick?: string; inbound?: string; layout?: string; tone?: string; assist?: string; book?: string; meet?: string; f?: string; wait?: string; cal?: string; state?: string; conflict?: string; connect?: string };
// Modals: ?meet=1 → book-call invite (prefilled) · ?conflict=1 → with "Agent found better slots" · ?connect=calendar|gmail|slack|crustdata → JIT connect
// (calendar continues into the invite; Not now leaves Keel's row waiting with a Connect chip) · ?book=1..7 pins a stage for review shots.
function liveWorkRows(deals: { domain: string; name: string }[]): WorkRow[] {
  return deals.map((d) => ({
    id: `live-${d.domain}`,
    company: { id: d.domain, name: d.name, initial: d.name[0] ?? d.domain[0]!, line: d.domain, sector: "Inbound", domain: d.domain },
    stage: "new",
    fit: { score: NaN, why: "Named in your inbox or a research run" }, // no fit computed for these: the pill reads "—"
    action: { kind: "review", label: "Open deal", recommended: true },
    href: `/deal?domain=${encodeURIComponent(d.domain)}`,
    when: "Inbox",
  }));
}

export default function Today({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  // Pitch-like inbound and researched companies only: other inbox threads (personal mail) never become rows.
  const pipelineDeals = usePipelineDeals();
  const live = realPipelineDeals(pipelineDeals.deals);
  const [step, setStep] = useState<OnboardingData["step"]>((Math.min(5, Math.max(1, Number(q.step) || 1)) as OnboardingData["step"]));
  const tick = q.tick !== "0";
  const jitTool = q.connect && q.connect in connectAsks ? q.connect : undefined;
  const flow = useBookFlow({ frame: bookFrame(q.book), connected: q.cal === "1" || (!!q.meet && !jitTool), initial: q.conflict === "1" ? "conflict" : q.meet === "1" ? "edit" : jitTool === "calendar" ? "ask" : undefined });
  const jit = useConnectFlow(!!jitTool && jitTool !== "calendar");
  const [meet, setMeet] = useState(q.meet === "1" ? undefined : q.meet);
  const [row, setRow] = useState<string | undefined>(q.wait || jitTool ? "w1" : undefined);
  const mode = useDataMode();
  // Live mode without a fixture variant param: the same Today screen fed from real sources (src/live/todaySummary.tsx).
  if (mode === "live" && Object.values(q).every((v) => v == null)) return <LiveTodaySummary shell={liveShellFrom(shellInvest)} ask={todaySummary.ask} pipeline={live} />;
  if (q.first) return <OnboardingScreen shell={shellFirstRun} data={onboarding(step)} slackPreview={slackHoldApproval} onStep={setStep} onNext={() => setStep((s) => Math.min(5, s + 1) as OnboardingData["step"])} onBack={() => setStep((s) => Math.max(1, s - 1) as OnboardingData["step"])} />;
  const bank = q.mode === "bank";
  const overlay = q.run ? <RunPanel run={agentRun} /> : q.k ? <CommandPalette data={q.denied ? paletteDenied : palette} /> : q.ask ? <AskPanel data={q.ask === "denied" ? askDenied : askAnswer} /> : undefined;
  if (q.layout === "calm" && !bank) return <TodayCalmScreen shell={shellInvest} data={todayCalm} assistant={q.assist ? assistantAt(Number(q.assist), askByPage.today) : todayAssistant} tone={q.tone === "mono" ? "mono" : "warm"} overlay={overlay} />;
  const classic = q.layout === "classic" || bank || q.hold || q.inbound || q.run || q.k || q.ask;
  if (!classic) {
    const m = nextMeetings.find((x) => x.id === meet);
    const waiting = row && jit.waiting && jitTool ? { [row]: connectAsks[jitTool].tool } : (q.wait || flow.waiting) && row ? { [row]: "calendar" as const } : undefined;
    const ov = jit.state !== "closed" && jitTool ? <ConnectFlow flow={jit} ask={connectAsks[jitTool]} /> : flow.stage !== "closed" ? <BookFlow flow={flow} data={keelCall} ask={calendarAsk} /> : m ? <MeetingPanel m={m} onClose={() => setMeet(undefined)} /> : undefined;
    const status = q.state === "loading" || q.state === "error" || q.state === "empty" ? q.state : "ready";
    // ?assist=1..6 opens the docked assistant at that frame (page-aware Today suggestions); ⌘K opens it empty.
    const inbound = liveWorkRows(live);
    const rows = q.state === "empty" ? inbound : [...inbound, ...todaySummary.rows];
    const screen = <TodaySummaryScreen shell={shellInvest} data={{ ...todaySummary, rows }} status={status} error={status === "error" ? "Couldn’t load today’s inbound." : undefined} overlay={ov} filter={(q.f as "all") || "all"} waiting={waiting} activeMeeting={meet}
      onMeeting={setMeet} onAction={(id, k) => { if (jit.waiting && id === row) { jit.open(); return; } if (k === "book") { setRow(id); flow.start(); } }} />;
    return q.assist ? <AssistantHost dock={<AssistantDock data={assistantAt(Number(q.assist), askByPage.today)} />}>{screen}</AssistantHost> : screen;
  }
  return <TodayScreen shell={bank ? shellBank : shellInvest} data={bank ? todayBank : q.hold ? todayInvestHolding : q.inbound ? todayWithInbound : todayInvest} overlay={overlay} holdMinutes={5} tick={tick} />;
}
