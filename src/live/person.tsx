"use client";
// Person page: /person?linkedin=<profile URL>[&domain=] → GET /api/live/person (Crustdata /person/enrich,
// 1 credit, cached). Email opens the Gmail connect prompt (Gmail isn't connected in this build); no Book meeting.
import { useRouter } from "next/navigation";
import { PersonScreen } from "@port/screens/person";
import { Page, TopBar } from "@port/components/shell";
import { EmptyState } from "@port/components/states";
import type { LoadStatus, PersonTab, ShellData } from "@port/types";
import { toLivePerson } from "@/lib/adapters/person";
import type { LiveCall, LivePerson } from "@/lib/live/types";
import { useEffect, useRef } from "react";
import { useLiveCoverage } from "@/components/datamode";
import { recordEvent } from "./memory";
import { failureMessage, useLiveJson } from "./useLiveJson";

type Res = { status: "ok"; person: LivePerson; call: LiveCall } | { status: "no_match"; linkedinUrl: string; call: LiveCall };

export function LivePerson({ shell, linkedin, domain, tab }: { shell: ShellData; linkedin?: string; domain?: string; tab?: PersonTab }) {
  useLiveCoverage(linkedin ? "Live · Crustdata" : null);
  const router = useRouter();
  const res = useLiveJson<Res>(linkedin ? `/api/live/person?linkedin=${encodeURIComponent(linkedin)}` : null);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || res.state !== "ok" || res.data.status !== "ok") return;
    opened.current = true;
    void recordEvent({ kind: "person.opened", subject: { type: "person", id: linkedin!, label: res.data.person.name }, summary: `Opened ${res.data.person.name}'s profile` });
  }, [res, linkedin]);
  const top = (label: string) => <TopBar crumbs={[{ label: "Pipeline", href: "/pipeline" }, { label }]} ctx={label} />;
  if (!linkedin) return <Page active="pipeline" shell={shell} top={top("Person")}><EmptyState title="Open a person from a live deal" body="Founders on a live deal’s Team section open here, enriched from Crustdata by their profile URL." /></Page>;
  if (res.state === "ok" && res.data.status === "no_match") return <Page active="pipeline" shell={shell} top={top("Person")}><EmptyState title="No Crustdata match" body={`/person/enrich returned no profile for ${res.data.linkedinUrl}.`} /></Page>;
  const ok = res.state === "ok" && res.data.status === "ok" ? res.data : null;
  const name = ok?.person.name ?? linkedin.replace(/\/$/, "").split("/").pop()!;
  const data = toLivePerson(ok?.person ?? { name, current: [], past: [], schools: [] }, { linkedinUrl: linkedin, domain, retrievedAt: ok?.call.retrievedAt });
  const status: LoadStatus = res.state === "loading" ? "loading" : res.state === "failed" ? "error" : "ready";
  return (
    <PersonScreen key={linkedin} shell={shell} data={data} tab={tab ?? "activity"} status={status}
      error={res.state === "failed" ? failureMessage(res, `Couldn’t load ${name}`) : undefined} onRetry={() => void res.reload()}
      onEmail={() => router.push("/settings?section=connectors")} />
  );
}
