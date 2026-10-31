"use client";
// Deal team panel: roster · Sourced-by credit (locked) · owner suggestion + Claim.
// GET /api/deals/[id]/owner-suggestion · POST /api/deals/[id]/claim
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Sparkles, Check, UserPlus } from "lucide-react";
import { Avatar, Btn, Undo, cx } from "./ui";
import type { DealRole, DealTeam } from "../types";

const ROLE: Record<DealRole, string> = { lead: "Lead", team: "Deal team", contributor: "Contributor", partner: "Partner" };

export function DealTeamPanel({ team, me = "SG", onClaim, onAssign, onUndoClaim, onAddReviewer, reviewerAdded, className }: {
  /** Current user initials, shown optimistically after Claim. */
  me?: string;
  team: DealTeam;
  /** POST /api/deals/[id]/claim — optimistic; reject to roll back. */
  onClaim?: () => void | Promise<void>;
  /** Assign (assign_directly) or ask (ask_first) the suggested owner. */
  onAssign?: (userId: string) => void;
  onUndoClaim?: () => void;
  /** v4 · with a lead in place the suggestion becomes "Add <name> as second reviewer" (Undo restores it). */
  onAddReviewer?: (userId: string | null) => void;
  reviewerAdded?: boolean;
  className?: string;
}) {
  const [claimed, setClaimed] = useState(false);
  const [added, setAdded] = useState(!!reviewerAdded);
  const lead = team.members.find((m) => m.role === "lead");
  const s = team.suggestion, ask = team.ownerRule === "ask_first";
  const claim = async () => { setClaimed(true); try { await onClaim?.(); } catch { setClaimed(false); } };
  return (
    <div className={cx("rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]", className)}>
      <div className="flex items-center justify-between px-4 pt-3.5"><span className="eyebrow" title={ask ? "Firm rule: ask first" : "Firm rule: assign directly"}>Deal team</span></div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 px-4">
        {team.members.map((m) => (
          <span key={m.id} className="flex items-center gap-2 text-[12px]"><Avatar i={m.initials} size={24} tone={m.role === "lead" ? "ink" : "zinc"} /><span className="leading-tight"><span className="block font-medium">{m.name}</span><span className="text-[11px] text-zinc-500">{ROLE[m.role]}</span></span></span>
        ))}
        <AnimatePresence>{added && s && <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[12px]"><Avatar i={s.initials} size={24} tone="zinc" /><span className="leading-tight"><span className="block font-medium">{s.name}</span><span className="text-[11px] text-zinc-500">Second reviewer</span></span></motion.span>}</AnimatePresence>
        <AnimatePresence>{claimed && <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[12px]"><Avatar i={me} size={24} tone="ink" /><span className="leading-tight"><span className="block font-medium">You</span><span className="text-[11px] text-zinc-500">Lead</span></span></motion.span>}</AnimatePresence>
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-lg bg-zinc-50 px-3 py-2 text-[11.5px]">
        <Avatar i={team.sourcedBy.initials} size={22} tone="sand" /><span className="min-w-0 leading-tight"><span className="block"><span className="text-zinc-500">Sourced by </span><span className="font-medium">{team.sourcedBy.name}</span></span><span className="block truncate text-[11px] text-zinc-500">{team.sourcedBy.via} · {team.sourcedBy.at}</span></span>
        {team.sourcedBy.locked && <Lock aria-label="Credit is locked" className="ml-auto size-3 shrink-0 text-zinc-400" />}
      </div>
      {!lead && !claimed && (s || team.canClaim) && (
        <div className="mx-4 mt-3 rounded-lg border border-rust-100 bg-rust-50/50 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium"><Sparkles className="size-3.5 text-rust" />No lead yet</div>
          {s && <div className="mt-1.5 text-[12px] text-zinc-700">Suggested: <b className="font-semibold">{s.name}</b> · {s.reasons.join(" · ")}</div>}
          <div className="mt-2.5 flex items-center gap-2">
            {team.canClaim && <Btn variant="primary" onClick={claim}>Claim</Btn>}
            {s && <Btn onClick={() => onAssign?.(s.userId)}>{ask ? `Ask ${s.name.split(" ")[0]}` : `Assign ${s.name.split(" ")[0]}`}</Btn>}
          </div>
        </div>
      )}
      {lead && s && (added
        ? <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-ok-50 px-3 py-2 text-[12px] text-ok"><Check className="size-3.5 shrink-0" /><span className="min-w-0 truncate">{s.name.split(" ")[0]} added · review request sent</span><Undo className="ml-auto" onClick={() => { setAdded(false); onAddReviewer?.(null); }} /></div>
        : <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-zinc-200 px-3 py-2">
            <Avatar i={s.initials} size={22} tone="zinc" />
            <span title={s.reasons.join(" · ")} className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[12px] font-medium">{s.name}</span><span className="block truncate text-[11px] text-zinc-500">Suggested second reviewer</span></span>
            <button type="button" aria-label={`Add ${s.name} as second reviewer`} onClick={() => { setAdded(true); onAddReviewer?.(s.userId); }} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[12px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink hover:ring-zinc-300"><UserPlus className="size-3.5" />Add</button>
          </div>)}
      {claimed && <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-ok-50 px-3 py-2 text-[12px] text-ok"><Check className="size-3.5" />You’re the lead. {team.sourcedBy.name.split(" ")[0]} keeps the sourcing credit.<Undo className="ml-auto" onClick={() => { setClaimed(false); onUndoClaim?.(); }} /></div>}
      <div className="h-3.5" />
    </div>
  );
}
