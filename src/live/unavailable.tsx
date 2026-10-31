"use client";
// Honest "not available in this build" page for screens with no live data source. It says what the screen needs,
// shows the REAL status of each connector it depends on (GET /api/integrations/connectors) and never renders sample
// data. `children` add whatever live content the screen can show (memory feed, a research form …).
import Link from "next/link";
import type { ReactNode } from "react";
import { Page, TopBar } from "@port/components/shell";
import type { Crumb, Mode, Nav } from "@port/types";
import type { IntegrationInfo, IntegrationsResponse } from "@/lib/live/types";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { liveShell } from "./shell";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { SOURCES, type ScreenId } from "./sources";

const TONE: Record<IntegrationInfo["status"], string> = { connected: "bg-[#2f9a5c]", not_configured: "bg-zinc-300", error: "bg-[#c98a1b]" };
const LABEL: Record<IntegrationInfo["status"], string> = { connected: "Connected", not_configured: "Not configured", error: "Needs attention" };

export function Requirements({ needs }: { needs: string[] }) {
  const res = useLiveJson<IntegrationsResponse>(needs.some((n) => n !== "backend") ? "/api/integrations/connectors" : null);
  return (
    <ul className="mt-4 divide-y divide-zinc-100 rounded-xl bg-white text-left ring-1 ring-zinc-200/80" data-testid="requirements">
      {needs.map((id) => {
        if (id === "backend") return (
          <li key={id} className="flex items-start gap-3 px-4 py-2.5 text-[12.5px]" data-need="backend">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-300" />
            <span className="min-w-0"><span className="font-medium text-ink">Deal Desk backend</span><span className="block text-zinc-500">Not in this build — the deal store, pipeline and agents live in the builder backend (branch builder-main), not connected here.</span></span>
          </li>
        );
        const info = res.state === "ok" ? res.data.connectors.find((c) => c.id === id) : undefined;
        return (
          <li key={id} className="flex items-start gap-3 px-4 py-2.5 text-[12.5px]" data-need={id} data-status={info?.status ?? res.state}>
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${info ? TONE[info.status] : "bg-zinc-200"}`} />
            <span className="min-w-0">
              <span className="font-medium text-ink">{info?.name ?? id}</span>
              <span className="text-zinc-500"> · {info ? LABEL[info.status] : res.state === "failed" ? failureMessage(res, "Status check") : "checking…"}</span>
              {info && <span className="block text-zinc-500" title={info.lastCheckedAt ? `Checked ${fmtDateTime(info.lastCheckedAt)}` : undefined}>{info.detail}{info.lastCheckedAt ? ` · checked ${fmtAgo(info.lastCheckedAt)}` : ""}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function UnavailableBlock({ screen, action }: { screen: ScreenId; action?: ReactNode }) {
  const s = SOURCES[screen];
  return (
    <div data-testid="unavailable" data-screen={screen} className="mx-auto mt-14 max-w-[560px] rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-7 text-center @max-[720px]/main:mt-6 @max-[720px]/main:px-4 @max-[720px]/main:py-6">
      <div className="serif text-[22px]">{s.title}</div>
      <p className="mt-1 text-[13px] text-zinc-500">{s.reason}</p>
      <Requirements needs={s.needs} />
      <div className="mt-4 flex justify-center gap-2 text-[12.5px]">
        {action}
        {s.needs.some((n) => n !== "backend") && <Link href="/settings?section=connectors" className="inline-flex h-8 items-center rounded-full bg-white px-3.5 font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink @max-[720px]/main:h-10 @max-[720px]/main:px-4">Connectors</Link>}
      </div>
    </div>
  );
}

/** Full page: app chrome + the unavailable block + optional live content below. */
export function UnavailablePage({ screen, active, crumbs, mode, action, dock, children }: { screen: ScreenId; active: Nav; crumbs?: Crumb[]; mode?: Mode; action?: ReactNode; /** right-hand panel (the /today voice assistant) */ dock?: ReactNode; children?: ReactNode }) {
  const s = SOURCES[screen];
  return (
    <Page active={active} mode={mode} shell={liveShell} dock={dock} top={<TopBar crumbs={crumbs ?? [{ label: s.label }]} ctx={s.label} />}>
      <div className="px-4 pb-6 max-lg:pb-24">
        <UnavailableBlock screen={screen} action={action} />
        {children && <div className="mx-auto mt-6 mb-16 w-full max-w-[560px]">{children}</div>}
      </div>
    </Page>
  );
}
