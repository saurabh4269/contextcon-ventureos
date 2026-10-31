"use client";
// IC memo: /memo?id=<domain> → GET /api/deals/:id/numbers. The memo's numbers (ARR used, valuation, comps line,
// diligence verdict, fit, criteria, return multiples) are rendered from their ComputedFields — in this build they are
// unavailable with the builder pipeline's reason, while the Crustdata-backed ones (headcount, growth, last funding) are
// live. Each row expands to its reasoning and citations.
import Link from "next/link";
import { Page, TopBar } from "@port/components/shell";
import { EmptyState, ErrorState, ScreenSkeleton } from "@port/components/states";
import { fmtM } from "@/lib/adapters/deal";
import { isOk } from "@/lib/fields";
import { fmtInt, fmtPct } from "@/lib/format";
import type { DealNumberKey, NumbersResponse } from "@/lib/numbers/deal-numbers";
import { FieldRow } from "./field";
import { liveShell } from "./shell";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { UnavailablePage } from "./unavailable";
import { ResearchForm } from "./deal";
import { Outreach } from "./outreach";

const str = (v: unknown) => String(v);
const pts = (v: unknown) => `${fmtInt(v)} / 100`;
const x = (v: unknown) => `${String(v)}×`;
const ROWS: { group: string; rows: [DealNumberKey, string, (v: unknown) => string][] }[] = [
  { group: "Recommendation", rows: [["diligenceVerdict", "Diligence verdict", str], ["fitScore", "Fit score", pts]] },
  { group: "Memo figures", rows: [["icMemoArrUsedM", "ARR used", fmtM], ["icMemoValuation", "Valuation", fmtM], ["icMemoCompsLine", "Comps line", str], ["compsMedianMultiple", "Comps median multiple", x], ["returnMultipleLow", "Return multiple (low)", x], ["returnMultipleHigh", "Return multiple (high)", x]] },
  { group: "Mandate fit", rows: [["criterionSector", "Sector", str], ["criterionStage", "Stage", str], ["criterionGeo", "Geography", str], ["criterionCheckSize", "Check size", str], ["criterionMemory", "Firm memory", str]] },
  { group: "Company (Crustdata)", rows: [["headcountLatest", "Headcount", fmtInt], ["growthYoY", "Headcount growth, year over year", fmtPct], ["lastFundingUsdM", "Last funding round", fmtM]] },
];

export function LiveMemo({ id }: { id?: string }) {
  if (!id) return <UnavailablePage screen="memo" active="pipeline"><ResearchForm /></UnavailablePage>;
  return <MemoFor key={id} id={id} />;
}

function MemoFor({ id }: { id: string }) {
  const res = useLiveJson<NumbersResponse>(`/api/deals/${encodeURIComponent(id)}/numbers`);
  const top = <TopBar crumbs={[{ label: id, href: `/deal?domain=${encodeURIComponent(id)}` }, { label: "IC memo" }]} ctx={id} />;
  if (res.state === "loading") return <Page active="pipeline" shell={liveShell} top={top}><ScreenSkeleton cols="grid-cols-[1fr]" /></Page>;
  if (res.state === "failed") return (
    <Page active="pipeline" shell={liveShell} top={top}>
      {res.body?.status === "no_match" ? <EmptyState title="No Crustdata match" body={res.body.message} /> : <ErrorState message={failureMessage(res, `Couldn’t load the memo numbers for ${id}`)} onRetry={() => void res.reload()} />}
    </Page>
  );
  const f = res.data.fields;
  const drafted = isOk(f.icMemoValuation) && isOk(f.diligenceVerdict);
  // email body = the memo's own computed values (unavailable ones say so, never a placeholder number)
  const summary = [`IC memo · ${res.data.id}`, "", ...ROWS.flatMap((g) => [`${g.group}`, ...g.rows.map(([k, label, fmt]) => { const v = f[k]; return `  ${label}: ${isOk(v) ? fmt(v.value) : "unavailable"}`; }), ""]), `Open: /memo?id=${res.data.id}`].join("\n");
  return (
    <Page active="pipeline" shell={liveShell} top={top}>
      <div className="mx-auto w-full max-w-[720px] px-6 pt-8 pb-16 max-lg:pb-24 @max-[720px]/main:px-4 @max-[720px]/main:pt-5" data-testid="memo">
        <div className="eyebrow">IC memo</div>
        <h1 className="serif mt-1 text-[32px] leading-tight">{res.data.id}</h1>
        {!drafted && <p className="mt-2 text-[13px] text-zinc-500">No memo drafted. {f.icMemoValuation.status === "unavailable" ? f.icMemoValuation.reason : ""}</p>}
        {ROWS.map((g) => (
          <section key={g.group} className="mt-6 rounded-2xl bg-white px-4 py-2 ring-1 ring-zinc-200/80">
            <h2 className="pt-2 pb-1 text-[12px] font-medium tracking-[.04em] text-zinc-400 uppercase">{g.group}</h2>
            {g.rows.map(([k, label, fmt]) => <FieldRow key={k} label={label} f={f[k]} fmt={fmt} testId={`memo-field-${k}`} />)}
          </section>
        ))}
        <Outreach dealId={res.data.id} summary={summary} />
        <p className="mt-4 text-[12px] text-zinc-400">Source: GET /api/deals/{res.data.id}/numbers · <Link href={`/deal?domain=${encodeURIComponent(res.data.id)}`} className="underline max-sm:inline-block max-sm:py-3">open the deal</Link></p>
      </div>
    </Page>
  );
}
