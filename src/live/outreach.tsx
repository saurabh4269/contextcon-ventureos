"use client";
// Send & schedule (memo page): email the memo summary and book a follow-up slot through the connected Google account.
// Every step is preview → explicit "Approve" click → server checks the single-use approval token, the recipient
// allowlist (DEMO_RECIPIENT_ALLOWLIST) and OUTBOUND_MODE (dry run unless live). Nothing is sent without the click.
import { useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { cx } from "@port/components/ui";

type Cfg = { mode: "dry_run" | "live"; allowlist: string[] };
type Slot = { start: string; end: string };
type Pending = { kind: "email"; token: string } | { kind: "slot"; token: string; slot: Slot };

const btn = "h-8 max-sm:h-10 rounded-full px-3.5 text-[12.5px] font-medium";
async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { r, j: (await r.json().catch(() => null)) as { status?: string; message?: string; label?: string; transport?: string; approval?: { token: string }; message_id?: string } | null };
}

export function Outreach({ dealId, summary }: { dealId: string; summary: string }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(`Deal Desk · IC memo · ${dealId}`);
  const [body, setBody] = useState(summary);
  const [pending, setPending] = useState<Pending | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);
  const say = (ok: boolean, text: string) => setLog((l) => [...l, { ok, text }]);

  useEffect(() => {
    void fetch("/api/outbound/email").then((r) => r.json()).then((j: Cfg) => { setCfg(j); setTo((t) => t || j.allowlist[0] || ""); }).catch(() => setCfg(null));
  }, []);
  useEffect(() => setBody(summary), [summary]);

  const email = { to: [to.trim()], subject, body };
  const previewEmail = async () => {
    const { r, j } = await post("/api/outbound/email", { action: "preview", ...email });
    if (!r.ok || !j?.approval) return say(false, j?.message ?? `Preview failed (HTTP ${r.status})`);
    setPending({ kind: "email", token: j.approval.token });
  };
  const approveEmail = async () => {
    if (pending?.kind !== "email") return;
    const { r, j } = await post("/api/outbound/email", { action: "send", ...email, approvalToken: pending.token });
    setPending(null);
    if (!r.ok) return say(false, j?.message ?? `Not sent (HTTP ${r.status})`);
    say(true, j?.transport === "dry_run" ? `${j.label}: email to ${to} built, not sent.` : `Sent to ${to} from the connected Gmail.`);
  };
  const findSlots = async () => {
    const r = await fetch("/api/connectors/calendar/slots?minutes=30&count=3&days=5");
    const j = (await r.json().catch(() => null)) as { slots?: Slot[]; message?: string; window?: { hours?: string } } | null;
    if (!r.ok || !j?.slots) return say(false, j?.message ?? `Couldn’t read the calendar (HTTP ${r.status})`);
    setSlots(j.slots);
    if (!j.slots.length) say(false, `No free slot of that length in the window searched${j.window?.hours ? ` (${j.window.hours})` : ""}.`);
  };
  const event = (s: Slot) => ({ summary: `Deal Desk follow-up · ${dealId}`, start: s.start, end: s.end, attendees: [to.trim()], description: `Follow-up on the IC memo for ${dealId}.` });
  const previewSlot = async (s: Slot) => {
    const { r, j } = await post("/api/connectors/calendar/events", { action: "preview", ...event(s) });
    if (!r.ok || !j?.approval) return say(false, j?.message ?? `Preview failed (HTTP ${r.status})`);
    setPending({ kind: "slot", token: j.approval.token, slot: s });
  };
  const approveSlot = async () => {
    if (pending?.kind !== "slot") return;
    const { r, j } = await post("/api/connectors/calendar/events", { ...event(pending.slot), approvalToken: pending.token });
    const when = fmtDateTime(pending.slot.start);
    setPending(null);
    if (!r.ok) return say(false, j?.message ?? `Not booked (HTTP ${r.status})`);
    say(true, j?.transport === "dry_run" ? `${j.label}: would book ${when}.` : `Booked ${when} on the connected calendar (no invitations sent).`);
  };

  return (
    <section className="mt-6 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200/80" data-testid="outreach">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-medium tracking-[.04em] text-zinc-400 uppercase">Send &amp; schedule</h2>
        {cfg && <span className={cx("rounded-full px-2 py-0.5 text-[11px]", cfg.mode === "live" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500")} data-testid="outreach-mode">{cfg.mode === "live" ? `Live · only ${cfg.allowlist.join(", ")}` : "Dry run · nothing leaves the app"}</span>}
      </div>
      <div className="mt-2 space-y-2">
        <input aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPending(null); }} className="h-8 w-full rounded-lg bg-zinc-50 px-3 text-[12.5px] ring-1 ring-zinc-200 outline-none" />
        <input aria-label="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); setPending(null); }} className="h-8 w-full rounded-lg bg-zinc-50 px-3 text-[12.5px] ring-1 ring-zinc-200 outline-none" />
        <textarea aria-label="Body" value={body} onChange={(e) => { setBody(e.target.value); setPending(null); }} rows={6} className="w-full rounded-lg bg-zinc-50 px-3 py-2 font-mono text-[11.5px] ring-1 ring-zinc-200 outline-none" />
        <div className="flex flex-wrap items-center gap-2">
          {pending?.kind === "email"
            ? <><button type="button" onClick={() => void approveEmail()} className={cx(btn, "bg-ink text-white")} data-testid="approve-email">Approve &amp; send to {to}</button><button type="button" onClick={() => setPending(null)} className="px-2 text-[12.5px] text-zinc-500">Cancel</button></>
            : <button type="button" onClick={() => void previewEmail()} className={cx(btn, "bg-white ring-1 ring-zinc-200")} data-testid="preview-email">Review email</button>}
          <button type="button" onClick={() => void findSlots()} className={cx(btn, "bg-white ring-1 ring-zinc-200")} data-testid="find-slots">Find a 30-min slot</button>
        </div>
        {slots && slots.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="slots">
            {slots.map((s) => pending?.kind === "slot" && pending.slot.start === s.start
              ? <button key={s.start} type="button" onClick={() => void approveSlot()} className={cx(btn, "bg-ink text-white")} data-testid="approve-slot">Approve &amp; book {fmtDateTime(s.start)}</button>
              : <button key={s.start} type="button" onClick={() => void previewSlot(s)} className={cx(btn, "bg-zinc-50 ring-1 ring-zinc-200")}>{fmtDateTime(s.start)}</button>)}
          </div>
        )}
        {log.map((l, i) => <p key={i} role="status" className={cx("text-[12px]", l.ok ? "text-zinc-600" : "text-rust")}>{l.text}</p>)}
      </div>
    </section>
  );
}
