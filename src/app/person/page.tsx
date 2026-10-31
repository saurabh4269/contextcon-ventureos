"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// /person?id=ananya-rao|mo-haddad|ana-ruiz|ravi-menon (alex-rao → ananya-rao alias) · &tab=activity|emails|meetings|notes|files · &status=loading|empty|error · &book=1..7 pins a book-call frame
import { use } from "react";
import { PersonScreen } from "@port/screens/person";
import { BookFlow, useBookFlow, bookFrame } from "@port/components/bookflow";
import { shellInvest, personById, calendarAsk } from "@port/fixtures";
import type { LoadStatus, PersonTab } from "@port/types";
import { useDataMode } from "@/components/datamode";
import { namedLivePerson } from "@/lib/datamode";
import { LivePerson } from "@/live/person";
import { liveShellFrom } from "@/live/shell";

export default function Person({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string; status?: string; book?: string; linkedin?: string; domain?: string }> }) {
  const q = use(searchParams);
  const mode = useDataMode();
  const data = personById(q.id);
  const flow = useBookFlow({ frame: bookFrame(q.book), connected: true });
  const liveLinkedin = mode === "live" ? q.linkedin?.trim() || undefined : namedLivePerson(q);
  // Same PersonScreen: ?linkedin= overlays Crustdata even in demo. Fixture people (?id=) stay dummy.
  if (liveLinkedin || mode === "live") return <LivePerson shell={mode === "live" ? liveShellFrom(shellInvest) : shellInvest} linkedin={liveLinkedin} domain={q.domain} tab={q.tab as PersonTab} />;
  const status: LoadStatus = q.status === "loading" || q.status === "empty" || q.status === "error" ? q.status : "ready";
  const overlay = data.book && flow.stage !== "closed" ? <BookFlow flow={flow} data={data.book} ask={calendarAsk} /> : undefined;
  return <PersonScreen key={data.id} shell={shellInvest} data={data} tab={(q.tab as PersonTab) || "activity"} status={status} overlay={overlay} onBook={data.book ? flow.start : undefined} onAlertAction={() => {}} onRetry={() => {}} />;
}
