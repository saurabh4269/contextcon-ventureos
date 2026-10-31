"use client";
// Banking new-business gates: conflicts → engagement letter → KYC. Per mandate, compliance signs off.
import { Check, Clock, Ban, Circle, Scale, FileSignature, IdCard } from "lucide-react";
import { motion } from "framer-motion";
import { Btn, cx } from "./ui";
import type { GateState, MandateGate } from "../types";

const ICON = { conflicts: Scale, engagement: FileSignature, kyc: IdCard } as const;
const STATE: Record<GateState, { label: string; cls: string; Icon: typeof Check }> = {
  cleared: { label: "Cleared", cls: "bg-ok-50 text-ok border-ok-100", Icon: Check },
  pending: { label: "Waiting", cls: "bg-warn-50 text-warn border-warn-100", Icon: Clock },
  blocked: { label: "Blocked", cls: "bg-rust-50 text-rust border-rust-100", Icon: Ban },
  todo: { label: "Not started", cls: "bg-zinc-50 text-zinc-500 border-zinc-200", Icon: Circle },
};
const ACTION: Record<MandateGate["id"], string> = { conflicts: "Request conflict check", engagement: "Send for signature", kyc: "Start KYC" };
const SHORT: Record<MandateGate["id"], string> = { conflicts: "Conflicts", engagement: "EL", kyc: "KYC" };
const FIX: Record<MandateGate["id"], string> = { conflicts: "Review match", engagement: "Resend letter", kyc: "Request missing ID" };

export function GateBadge({ s }: { s: GateState }) {
  const { label, cls, Icon } = STATE[s];
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[11px] font-medium", cls)}><Icon className="size-3" />{label}</span>;
}

/** Full checklist (mandate not yet live). One primary action: the first gate that isn't cleared. */
export function GateChecklist({ gates, onAction }: { gates: MandateGate[]; onAction?: (gateId: MandateGate["id"]) => void }) {
  const cleared = gates.filter((g) => g.state === "cleared").length;
  const next = gates.find((g) => g.state !== "cleared" && g.state !== "pending");
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
        <span className="eyebrow">New business gates</span>
        <span className="tnum text-[12px] text-zinc-500"><b className="text-ink">{cleared}</b> of {gates.length} cleared</span>
        <span className="ml-auto flex w-[160px] gap-1">{gates.map((g) => <motion.span key={g.id} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} className={cx("h-1.5 flex-1 rounded-full", g.state === "cleared" ? "bg-ok" : g.state === "pending" ? "bg-warn/60" : "bg-zinc-200")} />)}</span>
      </div>
      <ol>
        {gates.map((g, i) => { const I = ICON[g.id]; return (
          <li key={g.id} className="grid grid-cols-[36px_1fr_auto] items-start gap-3 border-b border-zinc-100 px-5 py-4 last:border-0">
            <span className={cx("flex size-9 items-center justify-center rounded-lg", g.state === "cleared" ? "bg-ok-50 text-ok" : "bg-zinc-100 text-zinc-600")}><I className="size-4" /></span>
            <div>
              <div className="flex items-center gap-2"><span className="tnum text-[11px] text-zinc-400">{i + 1}</span><span className="text-[13.5px] font-semibold">{g.label}</span><GateBadge s={g.state} /></div>
              <div className="mt-1 text-[12.5px] text-zinc-600">{g.detail}</div>
              <div className="mt-1 text-[11.5px] text-zinc-400">{g.owner}{g.at && <> · {g.at}</>}</div>
            </div>
            <div className="pt-1">{next?.id === g.id ? <Btn variant="primary" onClick={() => onAction?.(g.id)}>{g.state === "blocked" ? FIX[g.id] : ACTION[g.id]}</Btn> : g.state === "pending" ? <Btn onClick={() => onAction?.(g.id)}>Nudge</Btn> : null}</div>
          </li>
        ); })}
      </ol>
    </div>
  );
}

/** One-line summary once the mandate is live. */
export function GateStrip({ gates }: { gates: MandateGate[] }) {
  const all = gates.every((g) => g.state === "cleared");
  return (
    <div className={cx("flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px]", all ? "border-zinc-200 bg-zinc-50/60" : "border-warn-100 bg-warn-50")}>
      <span className="font-medium text-zinc-600">Gates</span>
      {gates.map((g) => <span key={g.id} className="flex items-center gap-1 whitespace-nowrap text-zinc-600">{g.state === "cleared" ? <Check className="size-3 text-ok" /> : <Clock className="size-3 text-warn" />}<span title={g.label}>{SHORT[g.id]}</span></span>)}
      {all && <span className="ml-auto whitespace-nowrap text-ok">Cleared</span>}
    </div>
  );
}
