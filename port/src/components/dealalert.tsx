"use client";
/**
 * v4 · Diligence alert (S2_B) in Today's warm sienna language: the Ask card's wash, a rust orb, one claim per line with a
 * value bar, and two actions. "Verify with founder" opens a drafted email (saved to drafts, never sent from here);
 * "Request raw data" flips to a done state with Undo. Both report out through callbacks.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, FileUp, Mail, PenLine } from "lucide-react";
import { ModalClose, ModalFrame } from "./connect";
import { DeskMark, ToolLogo } from "./tools";
import { Avatar, Src, Undo, cx } from "./ui";
import { useReducedMotion } from "./motion";
import type { DiligenceAlert, EmailDraft } from "../types";

export type AlertInit = { sheet?: boolean; saved?: boolean; requested?: boolean };
const PILL = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-all duration-150";

export function AlertCard({ a, init, onVerify, onRequest }: { a: DiligenceAlert; init?: AlertInit; onVerify?: (draft: EmailDraft) => void; onRequest?: (undo?: boolean) => void }) {
  const r = useReducedMotion();
  const [sheet, setSheet] = useState(!!init?.sheet);
  const [saved, setSaved] = useState(!!init?.saved);
  const [requested, setRequested] = useState(!!init?.requested);
  const max = Math.max(...a.lines.map((l) => l.rate));
  return (
    <section aria-label={a.title} className="@container/alert relative overflow-hidden rounded-[20px] border border-[#f1e2d2] bg-[#fbf6f0] shadow-[0_1px_2px_rgba(120,60,20,.04),0_16px_36px_-20px_rgba(156,68,15,.28)]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-16 size-[300px] rounded-full bg-[radial-gradient(circle,rgba(206,112,52,.30),rgba(206,112,52,.08)_45%,transparent_70%)] blur-[6px]" />
        <div className="absolute -bottom-28 left-[30%] size-[280px] rounded-full bg-[radial-gradient(circle,rgba(246,196,120,.40),rgba(246,196,120,.10)_48%,transparent_72%)] blur-[2px]" />
      </div>
      <div className="relative p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_70%)] text-white shadow-[0_6px_14px_-6px_rgba(156,68,15,.7),inset_0_1px_0_rgba(255,255,255,.3)]"><AlertTriangle className="size-3.5" strokeWidth={2} /></span>
          <span className="text-[12.5px] font-medium text-rust">{a.eyebrow}</span>
          <span className="tnum ml-auto rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] text-zinc-600 ring-1 ring-black/[.04]">{a.period}</span>
        </div>
        <h3 className="serif mt-3 text-[24px] leading-tight">{a.title}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-zinc-500"><DeskMark size={16} />{a.reviewed.text}<span className="text-zinc-300">·</span><span className="tnum whitespace-nowrap">{a.reviewed.at}</span></div>
        <div className="mt-3.5 grid gap-2">
          {a.lines.map((l, i) => (
            <div key={l.id} className="grid grid-cols-[132px_minmax(0,1fr)_76px_auto] items-center gap-3 text-[13px] @max-[520px]/alert:grid-cols-[132px_minmax(0,1fr)_72px]">
              <span className="whitespace-nowrap text-zinc-600">{l.label}</span>
              <span className="h-2 rounded-full bg-white/80 ring-1 ring-black/[.03]">
                <motion.span initial={r ? false : { width: 0 }} animate={{ width: `${(l.rate / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                  className={cx("block h-full rounded-full", l.tone === "rust" ? "hatch-rust ring-1 ring-rust/30" : "bg-ink")} />
              </span>
              <span className={cx("tnum text-right font-semibold", l.tone === "rust" ? "text-rust" : "text-ink")}>{l.value}</span>
              <span className="@max-[520px]/alert:hidden"><Src k={l.source.kind} tone={l.tone === "rust" ? "rust" : "default"}>{l.source.label}</Src></span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#efdfcd] pt-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {saved ? (
              <motion.span key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/80 pr-3 pl-1.5 text-[12.5px] ring-1 ring-black/[.05]">
                <span className="grid size-6 place-items-center rounded-full bg-ok-50 text-ok"><Check className="size-3.5" strokeWidth={2.5} /></span>
                <span className="font-medium">{a.verify.draft.savedLabel}</span>
                <button type="button" onClick={() => setSheet(true)} className="font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-[3px] hover:text-ink">Edit</button>
                <Undo onClick={() => setSaved(false)} />
              </motion.span>
            ) : (
              <motion.button key="verify" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(true)}
                className={cx(PILL, "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] hover:-translate-y-px hover:bg-zinc-800 hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]")}>
                <Mail className="size-3.5 text-[#f0b48a]" strokeWidth={2} />{a.verify.label}
              </motion.button>
            )}
            {requested ? (
              <motion.span key="req" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/80 pr-3 pl-1.5 text-[12.5px] ring-1 ring-black/[.05]">
                <span className="grid size-6 place-items-center rounded-full bg-ok-50 text-ok"><Check className="size-3.5" strokeWidth={2.5} /></span>
                <span className="font-medium">{a.request.done}</span>
                <Undo onClick={() => { setRequested(false); onRequest?.(true); }} />
              </motion.span>
            ) : (
              <motion.button key="request" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setRequested(true); onRequest?.(); }}
                className={cx(PILL, "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:-translate-y-px hover:text-ink hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.22)] hover:ring-zinc-300")}>
                <FileUp className="size-3.5 text-zinc-400" strokeWidth={2} />{a.request.label}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
      {sheet && <DraftSheet d={a.verify.draft} title={a.verify.label} onClose={() => setSheet(false)} onSave={(d) => { setSaved(true); setSheet(false); onVerify?.(d); }} />}
    </section>
  );
}

/** Drafted email to the founder. Editable; "Save to drafts" keeps it in the user's mailbox, nothing is sent. */
export function DraftSheet({ d, title, onClose, onSave }: { d: EmailDraft; title: string; onClose?: () => void; onSave?: (d: EmailDraft) => void }) {
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body.join("\n\n"));
  return (
    <ModalFrame label={title} onClose={onClose} width={560}>
      <div className="flex items-center gap-3 px-6 pt-5">
        {d.app === "Gmail" ? <ToolLogo id="gmail" size={32} /> : <span className="grid size-8 place-items-center rounded-[9px] ring-1 ring-zinc-200"><Mail className="size-4 text-zinc-500" /></span>}
        <div className="min-w-0"><div className="text-[15px] font-medium">{title}</div><div className="text-[12px] text-zinc-500">Drafted by the diligence agent from the alert</div></div>
        <ModalClose className="ml-auto" onClick={onClose} />
      </div>
      <div className="mx-6 mt-5 divide-y divide-zinc-100 rounded-[14px] ring-1 ring-zinc-200/80">
        <div className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-14 text-zinc-500">To</span><span className="inline-flex items-center gap-2 rounded-full bg-zinc-50 py-0.5 pr-2.5 pl-0.5 ring-1 ring-zinc-200/70"><Avatar i={d.to.initials} size={22} tone="sand" /><span className="font-medium">{d.to.name}</span><span className="text-zinc-500">{d.to.email}</span></span></div>
        <div className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-14 text-zinc-500">From</span><span className="text-zinc-700">{d.from}</span></div>
        <label className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-14 text-zinc-500">Subject</span><input data-autofocus value={subject} onChange={(e) => setSubject(e.target.value)} className="min-w-0 flex-1 bg-transparent font-medium outline-none" /></label>
        <textarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="block w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-[1.6] text-zinc-800 outline-none" />
      </div>
      <div className="flex items-center gap-2 px-6 pt-4 pb-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500"><PenLine className="size-3.5" />Goes to your {d.app} drafts. Nothing is sent.</span>
        <button type="button" onClick={onClose} className={cx(PILL, "ml-auto h-9 bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-ink hover:ring-zinc-300")}>Cancel</button>
        <button type="button" onClick={() => onSave?.({ ...d, subject, body: body.split(/\n{2,}/) })} className={cx(PILL, "bg-ink text-white hover:bg-zinc-800")}>Save to drafts</button>
      </div>
    </ModalFrame>
  );
}
