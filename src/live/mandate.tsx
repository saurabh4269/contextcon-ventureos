"use client";
// Firm mandate editor. Every value is entered by the user; empty fields stay unset and deal scores say so.
import { useEffect, useState } from "react";
import { Page, TopBar } from "@port/components/shell";
import type { Mandate } from "@/lib/settings/mandate";
import { fmtDateTime } from "@/lib/format";
import { liveShell } from "./shell";

type Form = Record<"sectors" | "stages" | "geos" | "checkMin" | "checkMax" | "dilLow" | "dilHigh" | "retLow" | "retHigh", string>;
const toForm = (m: Mandate): Form => ({
  sectors: m.sectors.join(", "),
  stages: m.stages.join(", "),
  geos: m.geos.join(", "),
  checkMin: m.checkSizeUsd.min?.toString() ?? "",
  checkMax: m.checkSizeUsd.max?.toString() ?? "",
  dilLow: m.priors.dilutionPct?.low.toString() ?? "",
  dilHigh: m.priors.dilutionPct?.high.toString() ?? "",
  retLow: m.priors.returnMultiple?.low.toString() ?? "",
  retHigh: m.priors.returnMultiple?.high.toString() ?? "",
});
const pair = (low: string, high: string) => (low.trim() || high.trim() ? { low: low.trim(), high: high.trim() } : undefined);

const FIELDS: { key: keyof Form; label: string; hint: string; group: string }[] = [
  { key: "sectors", label: "Sectors", hint: "comma-separated, matched against Crustdata industries/categories", group: "Mandate" },
  { key: "stages", label: "Stages", hint: "Crustdata round types, e.g. seed, series_a", group: "Mandate" },
  { key: "geos", label: "Geographies", hint: "countries or cities, matched against HQ/country", group: "Mandate" },
  { key: "checkMin", label: "Check size min (USD)", hint: "", group: "Mandate" },
  { key: "checkMax", label: "Check size max (USD)", hint: "", group: "Mandate" },
  { key: "dilLow", label: "Dilution per round, low (%)", hint: "assumption: turns round size into post-money", group: "Priors (assumptions)" },
  { key: "dilHigh", label: "Dilution per round, high (%)", hint: "", group: "Priors (assumptions)" },
  { key: "retLow", label: "Target return multiple, low (×)", hint: "assumption shown as the deal's return multiple", group: "Priors (assumptions)" },
  { key: "retHigh", label: "Target return multiple, high (×)", hint: "", group: "Priors (assumptions)" },
];

export function MandateSettings() {
  const [form, setForm] = useState<Form | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; unset: string[] }>({ updatedAt: null, unset: [] });
  const [msg, setMsg] = useState<string>("");
  const load = (d: { mandate: Mandate; unset: string[] }) => {
    setForm(toForm(d.mandate));
    setMeta({ updatedAt: d.mandate.updatedAt, unset: d.unset });
  };
  useEffect(() => {
    fetch("/api/settings/mandate").then((r) => r.json()).then(load, (e) => setMsg(`Could not load the mandate: ${e}`));
  }, []);
  const save = async () => {
    if (!form) return;
    const body = {
      sectors: form.sectors,
      stages: form.stages,
      geos: form.geos,
      checkSizeUsd: { min: form.checkMin.trim() || undefined, max: form.checkMax.trim() || undefined },
      priors: { dilutionPct: pair(form.dilLow, form.dilHigh), returnMultiple: pair(form.retLow, form.retHigh) },
    };
    const res = await fetch("/api/settings/mandate", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) return setMsg(d.message ?? "Save failed");
    load(d);
    setMsg("Saved. Deal scores use it on their next load.");
  };
  return (
    <Page active="settings" shell={liveShell} top={<TopBar crumbs={[{ label: "Settings", href: "/settings" }, { label: "Firm mandate" }]} ctx="Settings" />}>
      <div className="mx-auto mt-8 mb-16 w-full max-w-[560px] px-4" data-testid="mandate">
        <div className="serif text-[22px]">Firm mandate</div>
        <p className="mt-1 text-[13px] text-zinc-500">
          Fit score, screener verdict, valuation range and return multiples are computed from these values and live Crustdata data. Empty fields stay unset and are reported as such.
          {meta.updatedAt ? ` Last saved ${fmtDateTime(meta.updatedAt)}.` : " Not set yet."}
          {meta.unset.length ? ` Unset: ${meta.unset.join(", ")}.` : ""}
        </p>
        {form && (
          <form className="mt-4 space-y-2 rounded-xl bg-white p-4 text-[12.5px] ring-1 ring-zinc-200/80" onSubmit={(e) => (e.preventDefault(), void save())}>
            {FIELDS.map((f, i) => (
              <div key={f.key}>
                {(i === 0 || FIELDS[i - 1]!.group !== f.group) && <div className="mt-2 mb-1 font-medium text-ink">{f.group}</div>}
                <label className="block">
                  <span className="text-zinc-600">{f.label}</span>
                  {f.hint && <span className="text-zinc-400"> · {f.hint}</span>}
                  <input name={f.key} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="mt-0.5 block h-8 w-full rounded-md px-2 ring-1 ring-zinc-200" />
                </label>
              </div>
            ))}
            <button type="submit" className="mt-3 inline-flex h-8 items-center rounded-full bg-ink px-3.5 font-medium text-white">Save mandate</button>
            {msg && <span className="ml-3 text-zinc-500" role="status">{msg}</span>}
          </form>
        )}
      </div>
    </Page>
  );
}
