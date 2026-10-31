"use client";
// Thin wrapper. ?frame=1..6 pins an assistant state; ?from=today|deal sets the "back to" link and the suggestions; ?state=loading|error|empty.
// ?q= overlays the live research agent on this route; the empty Ask page stays the fixture UI.
import { use, useState } from "react";
import { AskFullScreen } from "@port/screens/askfull";
import { shellInvest, assistantAt, helioAskEmpty, askFull } from "@port/fixtures";
import { ROUTES } from "@port/routes";
import { namedLiveQuery } from "@/lib/datamode";
import { LiveAsk } from "@/live/ask";

type Q = { frame?: string; from?: string; state?: string; q?: string };
export default function Ask({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const [frame, setFrame] = useState(Number(q.frame) || 1);
  const liveQ = namedLiveQuery(q);
  if (liveQ) return <LiveAsk shell={shellInvest} initialQuery={liveQ} />;
  const base = q.from === "deal" ? helioAskEmpty : askFull;
  const back = q.from === "deal" ? { label: "Back to Helio Sensors", href: ROUTES.deal("helio") } : { label: "Back to Today", href: ROUTES.today() };
  const status = q.state === "loading" || q.state === "error" || q.state === "empty" ? q.state : "ready";
  return <AskFullScreen shell={shellInvest} data={assistantAt(frame, base)} back={back} status={status} error={status === "error" ? "Couldn’t reach the assistant." : undefined} onSuggestion={() => setFrame(2)} onSend={() => setFrame(4)} />;
}
