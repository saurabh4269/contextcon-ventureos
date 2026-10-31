"use client";
// Live Today on the port TodaySummaryScreen (same component as the fixture page). Sources: deals worked on this
// server (exceptions → decisions + research per domain) plus GET /api/pipeline/deals companies (fetched by the page,
// pitch-like inbound only; no per-company Crustdata call), Gmail inbox metadata (pitch-like counts only, never a
// sender or subject), Google Calendar (meetings whose title names a kind). See src/lib/adapters/today.ts.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TodaySummaryScreen } from "@port/screens/todaysummary";
import type { ShellData, TodaySummaryData } from "@port/types";
import type { InboxThread } from "@/lib/google/gmail";
import type { Meeting } from "@/lib/google/calendar";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import { inboundWindow, realPipelineDeals, salutationAt, toTodaySummary } from "@/lib/adapters/today";
import { useLiveCoverage } from "@/components/datamode";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { useKnownDeals } from "./known";

/** The browser's IANA zone (the greeting follows the viewer); undefined falls back to IST. */
const viewerTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } };
const SPAN = 7; // days in the inbound chart (one week, like the fixture card)
const GMAIL_MAX = 25; // the threads route's own maximum
const MEETINGS_MAX = 10;
const DAY_MS = 86_400_000;

export function LiveTodaySummary({ shell, ask, pipeline }: { shell: ShellData; ask: TodaySummaryData["ask"]; pipeline: PipelineDealRow[] }) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const since = useMemo(() => new Date(now.getTime() - 2 * SPAN * DAY_MS).toISOString(), [now]);
  const known = useKnownDeals();
  const gmail = useLiveJson<{ threads: InboxThread[] }>(`/api/connectors/gmail/threads?since=${encodeURIComponent(since)}&max=${GMAIL_MAX}`);
  const cal = useLiveJson<{ events: Meeting[] }>(`/api/connectors/calendar/events?max=${MEETINGS_MAX}`);
  const sources = ["Crustdata", ...(gmail.state === "ok" ? ["Gmail"] : []), ...(cal.state === "ok" ? ["Calendar"] : [])];
  useLiveCoverage(`Live · ${sources.join(" · ")}`);

  const loading = known.state === "loading" || gmail.state === "loading" || cal.state === "loading";
  if (known.state === "failed") return <TodaySummaryScreen shell={shell} data={blank(now, ask)} status="error" error={failureMessage(known, "Deals")} onRetry={known.reload} />;
  if (loading || known.state !== "ok") return <TodaySummaryScreen shell={shell} data={blank(now, ask)} status="loading" />;

  const data = toTodaySummary({
    now,
    greeting: `${salutationAt(now, viewerTimeZone())}, ${shell.user.firstName}`,
    deals: known.data.deals,
    pipeline: realPipelineDeals(pipeline),
    open: known.data.exceptions.open,
    inbound: gmail.state === "ok"
      ? inboundWindow(gmail.data.threads, now, { span: SPAN, fetchedSince: since, truncated: gmail.data.threads.length >= GMAIL_MAX })
      : { unavailable: failureMessage(gmail, "Gmail") },
    inboundSpan: SPAN,
    meetings: cal.state === "ok" ? cal.data.events : [],
    ...(cal.state === "failed" ? { meetingsUnavailable: failureMessage(cal, "Google Calendar") } : {}),
    ask,
  });
  return <TodaySummaryScreen shell={shell} data={data} onAsk={(q) => router.push(`/ask?q=${encodeURIComponent(q)}`)} />;
}

/** Chrome-only data for the loading / error states (the screen renders the skeleton or error, not these values). */
const blank = (now: Date, ask: TodaySummaryData["ask"]): TodaySummaryData =>
  toTodaySummary({ now, greeting: "", deals: [], open: 0, inbound: { unavailable: "" }, inboundSpan: SPAN, meetings: [], ask });
