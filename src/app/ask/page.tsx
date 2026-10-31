"use client";
// Thin wrapper. ?frame=1..6 pins an assistant state; ?from=today|deal sets the "back to" link and the suggestions; ?state=loading|error|empty.
// ?q= overlays the live research agent on this route; the empty Ask page stays the fixture UI.
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AskFullScreen } from "@port/screens/askfull";
import { shellInvest, assistantAt, helioAskEmpty, askFull } from "@port/fixtures";
import { ROUTES } from "@port/routes";
import { namedLiveQuery } from "@/lib/datamode";
import { LiveAsk } from "@/live/ask";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { liveShell, liveShellFrom } from "@/live/shell";

type Q = { frame?: string; from?: string; state?: string; q?: string };
export default function Ask({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const [frame, setFrame] = useState(Number(q.frame) || 1);
  const liveQ = namedLiveQuery(q);
  const mode = useDataMode();
  if (liveQ) return <LiveAsk shell={mode === "live" ? liveShellFrom(shellInvest) : shellInvest} initialQuery={liveQ} />;
  // Live mode, empty page: the same first-run screen with real example questions; asking opens ?q= (the research agent).
  if (mode === "live" && !q.frame && !q.from && !q.state) return <LiveAskHome />;
  const base = q.from === "deal" ? helioAskEmpty : askFull;
  const back = q.from === "deal" ? { label: "Back to Helio Sensors", href: ROUTES.deal("helio") } : { label: "Back to Today", href: ROUTES.today() };
  const status = q.state === "loading" || q.state === "error" || q.state === "empty" ? q.state : "ready";
  return <AskFullScreen shell={shellInvest} data={assistantAt(frame, base)} back={back} status={status} error={status === "error" ? "Couldn’t reach the assistant." : undefined} onSuggestion={() => setFrame(2)} onSend={() => setFrame(4)} />;
}

function LiveAskHome() {
  const router = useRouter();
  useLiveCoverage("Live · Crustdata");
  const ask = (t: string) => { if (t.trim()) router.push(`/ask?q=${encodeURIComponent(t.trim())}`); };
  // No fixture chips or recent threads: suggestions are the research agent's own examples; there is no chat history store.
  const data = { ...askFull, context: "All deals", scopes: ["All deals"], suggestions: liveShell.assistant?.suggestions ?? [], recent: [] };
  return <AskFullScreen shell={liveShellFrom(shellInvest)} data={data} back={{ label: "Back to Today", href: ROUTES.today() }} onSuggestion={ask} onSend={ask} />;
}
