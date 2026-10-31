"use client";
// Thin wrapper. ?frame=1..6 pins an assistant state; ?from=today|deal sets the "back to" link and the suggestions; ?state=loading|error|empty.
import { use, useState } from "react";
import { AskFullScreen } from "@port/screens/askfull";
import { shellInvest, assistantAt, helioAskEmpty, askFull } from "@port/fixtures";
import { ROUTES } from "@port/routes";

type Q = { frame?: string; from?: string; state?: string };
export default function Ask({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const base = q.from === "deal" ? helioAskEmpty : askFull;
  const [frame, setFrame] = useState(Number(q.frame) || 1);
  const back = q.from === "deal" ? { label: "Back to Helio Sensors", href: ROUTES.deal("helio") } : { label: "Back to Today", href: ROUTES.today() };
  const status = q.state === "loading" || q.state === "error" || q.state === "empty" ? q.state : "ready";
  return <AskFullScreen shell={shellInvest} data={assistantAt(frame, base)} back={back} status={status} error={status === "error" ? "Couldn’t reach the assistant." : undefined} onSuggestion={() => setFrame(2)} onSend={() => setFrame(4)} />;
}
