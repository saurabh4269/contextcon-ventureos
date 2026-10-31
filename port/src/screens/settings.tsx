"use client";
import { useState, type ReactNode } from "react";
import { Plus, Plug, Lock, Mail, MessageSquare, GripVertical, UserPlus, Download, KeyRound, ShieldAlert, Check, Loader2, Workflow, Users, FileArchive, Blocks, ArrowRight, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Page, TopBar } from "../components/shell";
import { Pill, Btn, Toggle, Avatar, Undo, cx, IconBtn } from "../components/ui";
import { ConnectorsPage, type ConnectorsView } from "../components/connectors";
import { Rise } from "../components/motion";
import { AutonomyControl, Segmented, Chip } from "../components/firm";
import { WallBadge } from "../components/wall";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import { TOOL_NAME } from "../components/tools";
import type { FirmConfig, ScreenStatus, SettingsData, SettingsSection, ShellData, AccessDeniedRow } from "../types";

/** Only the connectors are known (no firm config/members source): the other sections render `unavailable`. */
export type SettingsConnectorsOnly = Pick<SettingsData, "isAdmin" | "connectors">;
const isFull = (d: SettingsData | SettingsConnectorsOnly): d is SettingsData => "config" in d && !!d.config;

export interface SettingsScreenProps extends ScreenStatus {
  shell: ShellData;
  data: SettingsData;
  section?: SettingsSection;
  onSection?: (s: SettingsSection) => void;
  /** PATCH /api/firm/config with the changed fields only. Autosaves; reject to roll back. */
  onPatchConfig?: (patch: Partial<FirmConfig>) => void | Promise<void>;
  /** Connectors: resolve when the tool is authorised (the JIT modal shows Connecting… until then); reject to go back. */
  onConnect?: (connectorId: string) => void | Promise<void>;
  onManageConnector?: (connectorId: string) => void;
  /** Connectors · Manage sheet: resolve when a manual sync / disconnect finishes. */
  onSyncConnector?: (connectorId: string) => void | Promise<void>;
  onConnectorScope?: (connectorId: string, scopeId: string, on: boolean) => void;
  onDisconnect?: (connectorId: string) => void | Promise<void>;
  /** Connectors: initial tab / search / category / open modal (from the URL). */
  connectorsView?: ConnectorsView;
  /** Connector Connect/Sync are simulated (demo data); labelled as such in the connect modal. */
  connectorsDemo?: boolean;
  onCopyMcp?: () => void;
  onToggleBrief?: (id: string, on: boolean) => void;
  onToggleGuardrail?: (id: string, on: boolean) => void;
  onInvite?: () => void;
  onChangeRole?: (memberId: string, role: string) => void;
  onManageWall?: (wallId: string) => void;
  onNewWall?: () => void;
  onExportAudit?: () => void;
  /** POST /api/firm/export → resolves with a download URL (or rejects). */
  onExportBundle?: () => Promise<{ url: string; size: string }>;
  /** Save a BYO LLM key. The raw key is sent once and never returned; resolve with the masked form. */
  onSaveKey?: (provider: string, key: string) => Promise<{ masked: string }>;
  onRemoveKey?: (keyId: string) => void;
}

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Workflow; admin?: boolean }[] = [
  { id: "workflow", label: "Workflow", icon: Workflow },
  { id: "connectors", label: "Connectors", icon: Blocks },
  { id: "members", label: "Members & walls", icon: Users },
  { id: "access", label: "Access audit", icon: ShieldAlert, admin: true },
  { id: "export", label: "Export & keys", icon: FileArchive },
];
const SURFACE: Record<AccessDeniedRow["surface"], string> = { web: "Deal page", ask: "Ask", cmdk: "⌘K", slack: "Slack", mcp: "MCP", api: "API" };

/* v3.2: `sub` explains the card on hover only; `meta` is the one visible status line. */
const Card = ({ title, sub, meta, right, children, className, i = 1 }: { title: string; sub?: string; meta?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; i?: number }) => (
  <Rise i={i} className={cx("card p-5", className)}>
    <div className="flex min-h-8 items-center gap-3"><div><div className="text-[14px] font-semibold" title={sub}>{title}</div>{meta && <div className="mt-0.5 text-[12px] text-zinc-500">{meta}</div>}</div><div className="ml-auto flex items-center gap-2">{right}</div></div>
    <div className="mt-4">{children}</div>
  </Rise>
);

export function SettingsScreen(props: Omit<SettingsScreenProps, "data"> & { data: SettingsData | SettingsConnectorsOnly; /** shown instead of a section whose data is not available */ unavailable?: (section: SettingsSection) => ReactNode }) {
  const { data: d, status = "ready" } = props;
  const p = props as SettingsScreenProps;
  const visible = SECTIONS.filter((s) => !s.admin || d.isAdmin);
  const section: SettingsSection = p.section === "integrations" ? "connectors" : p.section ?? "workflow"; // "integrations" is the v3 alias
  const blocked = section !== "connectors" && !isFull(d);
  const wide = section === "connectors" || blocked;
  const label = SECTIONS.find((s) => s.id === section)?.label ?? "Settings";
  return (
    <Page active="settings" shell={p.shell} top={<TopBar crumbs={[{ label: "Settings" }, { label }]} ctx="Settings" />}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[220px_1fr_340px]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : (
      <div className={cx("grid flex-1 grid-cols-1 content-start @min-[720px]/main:content-stretch @min-[720px]/main:grid-cols-[200px_minmax(0,1fr)]", !wide && "@min-[1180px]/main:grid-cols-[220px_minmax(0,1fr)_340px]")}>
        {/* Phone: the section list becomes a scrolling chip row above the content. */}
        <nav className="border-b border-zinc-200/70 px-3 py-2 @min-[720px]/main:row-span-2 @min-[720px]/main:border-r @min-[720px]/main:border-b-0 @min-[720px]/main:pt-5 @min-[720px]/main:pb-0">
          <div className="eyebrow px-2 @max-[720px]/main:hidden">Firm settings</div>
          <div className="mt-2 space-y-px @max-[720px]/main:-mx-3 @max-[720px]/main:mt-0 @max-[720px]/main:flex @max-[720px]/main:gap-1 @max-[720px]/main:space-y-0 @max-[720px]/main:overflow-x-auto @max-[720px]/main:px-3 @max-[720px]/main:[scrollbar-width:none]">{visible.map((s) => { const I = s.icon, on = s.id === section; return (
            <button type="button" key={s.id} aria-current={on ? "page" : undefined} onClick={() => p.onSection?.(s.id)} className={cx("flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] @max-[720px]/main:h-10 @max-[720px]/main:w-auto @max-[720px]/main:shrink-0 @max-[720px]/main:rounded-full @max-[720px]/main:px-3 @max-[720px]/main:whitespace-nowrap", on ? "bg-white font-medium ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-100/70")}>
              <I className="size-[15px] text-zinc-500" strokeWidth={1.75} />{s.label}{s.admin && <span className="ml-auto text-[10.5px] text-zinc-400">Admin</span>}{s.id === "connectors" && d.connectors.items.some((x) => x.status === "attention") && <span className="ml-auto size-1.5 rounded-full bg-[#c98a1b]" />}
            </button>); })}</div>
        </nav>
        <section className={cx("min-w-0 pt-7 pb-12 @max-[720px]/main:px-4 @max-[720px]/main:pt-5", wide ? "px-9" : "px-10")}>
          {blocked ? (props.unavailable?.(section) ?? <EmptyState title="Not available" body="This section has no data source in this build." />) : <>
          {section === "workflow" && <WorkflowSection {...p} />}
          {section === "connectors" && <ConnectorsPage data={d.connectors} initial={p.connectorsView} onConnect={p.onConnect} onManage={p.onManageConnector} onSync={p.onSyncConnector} onScope={p.onConnectorScope} onDisconnect={p.onDisconnect} demo={p.connectorsDemo} />}
          {section === "members" && <MembersSection {...p} />}
          {section === "access" && (d.isAdmin ? <AccessSection {...p} /> : <EmptyState title="Admins only" body="The access audit lists who was denied access to walled deals. Ask a firm admin." />)}
          {section === "export" && <ExportSection {...p} />}
          </>}
        </section>
        {!wide && isFull(d) && <aside className="border-t border-zinc-200/70 bg-white px-6 pt-6 pb-8 @max-[720px]/main:px-4 @min-[720px]/main:col-start-2 @min-[1180px]/main:col-start-auto @min-[1180px]/main:border-t-0 @min-[1180px]/main:border-l">
          {section === "members" ? <RolesAside d={d} /> : section === "access" ? <AccessAside /> : section === "export" ? <ExportAside d={d} /> : <BriefsAside {...p} />}
        </aside>}
      </div>
      )}
    </Page>
  );
}

/* ───────── Workflow: thesis, stages, pass templates, autonomy + hold, owner rule, integrations health ───────── */
function WorkflowSection(p: SettingsScreenProps) {
  const [cfg, setCfg] = useState(p.data.config);
  const [saved, setSaved] = useState<"saved" | "saving" | "failed">("saved");
  const patch = async (x: Partial<FirmConfig>) => {
    const prev = cfg; setCfg({ ...cfg, ...x }); setSaved("saving");
    try { await p.onPatchConfig?.(x); setSaved("saved"); } catch { setCfg(prev); setSaved("failed"); }
  };
  const t = cfg.thesis, bank = cfg.mode === "bank";
  const cs = p.data.connectors.items, fix = cs.filter((i) => i.status === "attention"), on = cs.filter((i) => i.status === "connected").length, core = cs.filter((i) => i.tier === "core").length;
  return (
    <>
      <div className="flex items-end justify-between">
        <h1 className="serif text-[32px] leading-none" title="How Deal Desk works for the whole firm. Changes save as you go.">Workflow</h1>
        <span aria-live="polite" className={cx("flex items-center gap-1.5 text-[12px]", saved === "failed" ? "text-rust" : "text-zinc-500")}>{saved === "saving" ? <><Loader2 className="size-3.5 motion-safe:animate-spin" />Saving…</> : saved === "failed" ? "Couldn’t save. Reverted." : <><Check className="size-3.5 text-ok" />All changes saved</>}</span>
      </div>
      {fix.length > 0 && <Rise i={0} className="mt-5 flex items-center gap-3 rounded-xl border border-warn-100 bg-warn-50/80 px-4 py-2.5 text-[12.5px]"><span className="size-1.5 rounded-full bg-[#c98a1b]" /><span><b className="font-medium">{fix.map((f) => f.title ?? TOOL_NAME[f.tool]).join(", ")}</b> needs reconnecting · {on} of {core} core connectors healthy</span><button type="button" onClick={() => p.onSection?.("connectors")} className="ml-auto flex items-center gap-1 font-medium text-warn">Reconnect<ArrowRight className="size-3.5" /></button></Rise>}
      <div className="mt-5 space-y-4">
        <Card title={bank ? "Coverage" : "Thesis"} sub={bank ? "What mandates we take" : "What Deal Desk scores every inbound deal against"}>
          <div className="grid grid-cols-[88px_1fr] items-center gap-y-2.5 text-[12.5px]">
            <span className="text-zinc-500">Sectors</span><span className="flex flex-wrap gap-1.5">{t.sectors.map((s) => <Chip key={s}>{s}</Chip>)}<Chip on={false}>+ Add</Chip></span>
            <span className="text-zinc-500">Stages</span><span className="flex flex-wrap gap-1.5">{t.stages.map((s) => <Chip key={s}>{s}</Chip>)}</span>
            <span className="text-zinc-500">Geography</span><span className="flex flex-wrap gap-1.5">{t.geos.map((s) => <Chip key={s}>{s}</Chip>)}</span>
            <span className="text-zinc-500">{bank ? "Deal size" : "Check size"}</span><span className="tnum font-semibold">${t.checkSize.min}–{t.checkSize.max}{t.checkSize.unit}{t.ownershipTarget !== undefined && <span className="ml-2 font-normal text-zinc-500">· target {t.ownershipTarget}% ownership</span>}</span>
          </div>
        </Card>
        <Card i={2} title="Agent autonomy" sub="What Deal Desk may do without asking. Everything that leaves the firm waits for the hold.">
          <AutonomyControl value={cfg.autonomy} holdMinutes={cfg.holdMinutes} onChange={(a) => patch({ autonomy: a })} onHold={(m) => patch({ holdMinutes: m })} />
        </Card>
        <div className="grid grid-cols-2 gap-4 @max-[720px]/main:grid-cols-1">
          <Card i={3} title="New deal owner" sub="When nobody has claimed a deal">
            <Segmented label="Owner rule" value={cfg.ownerRule} onChange={(v) => patch({ ownerRule: v })} options={[{ id: "assign_directly", label: "Assign directly", sub: "Best match becomes lead" }, { id: "ask_first", label: "Ask first", sub: "Suggest, they accept" }]} />
          </Card>
          <Card i={3} title={bank ? "Mandate stages" : "Pipeline stages"} sub="Drag to reorder" right={<IconBtn icon={<Plus />} label="Add stage" size="sm" />}>
            <ol className="flex flex-wrap gap-1.5">{cfg.stages.map((s, i) => <li key={s.id} className="flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white pr-2.5 pl-1 text-[12px]"><GripVertical className="size-3.5 text-zinc-300" /><span className="tnum mr-1 text-[10.5px] text-zinc-400">{i + 1}</span>{s.label}</li>)}</ol>
          </Card>
        </div>
        <Card i={4} title="Pass templates" sub="Deal Desk drafts passes from these. Founders always get a reason." right={<IconBtn icon={<Plus />} label="Add template" size="sm" />}>
          <div className="-mx-5 -mb-5 border-t border-zinc-100">{cfg.passTemplates.map((x) => <div key={x.id} className="grid grid-cols-[150px_1fr_70px] items-center gap-4 border-b border-zinc-100 px-5 py-2.5 text-[12.5px] last:border-0"><span className="font-medium">{x.reason}</span><span className="truncate text-zinc-500">“{x.preview}”</span><span className="tnum text-right text-[11.5px] text-zinc-400">{x.uses} sent</span></div>)}</div>
        </Card>
      </div>
    </>
  );
}

/* ───────── Members, roles, wall groups (firm_members) ───────── */
function MembersSection(p: SettingsScreenProps) {
  const d = p.data, invited = d.members.filter((m) => m.status === "invited").length;
  return (
    <>
      <div className="flex items-end justify-between">
        <div><h1 className="serif text-[32px] leading-none">Members & walls</h1><div className="mt-2 text-[13px] text-zinc-500"><span className="tnum">{d.members.length}</span> people{invited > 0 && <> · <span className="tnum">{invited}</span> invited</>}</div></div>
        {d.isAdmin && <IconBtn icon={<UserPlus />} label="Invite member" tone="primary" onClick={p.onInvite} />}
      </div>
      <Rise i={1} className="card mt-6 overflow-hidden">
        <div className="grid h-9 grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.4fr)_70px] items-center gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 text-[11.5px] font-medium text-zinc-500"><span>Person</span><span>Role</span><span>Walls</span><span className="text-right">Status</span></div>
        {d.members.map((m) => (
          <div key={m.id} className="grid h-[56px] grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.4fr)_70px] items-center gap-4 border-b border-zinc-100 px-5 text-[12.5px] last:border-0">
            <span className="flex min-w-0 items-center gap-2.5"><Avatar i={m.initials} size={26} tone={m.status === "active" ? "ink" : "zinc"} /><span className="min-w-0"><span className="block truncate font-medium">{m.name}</span><span className="block truncate text-[11px] text-zinc-500">{m.email}</span></span></span>
            <span>{d.isAdmin ? <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => p.onChangeRole?.(m.id, e.target.value)} className="h-7 rounded-md border border-zinc-200 bg-white px-1.5 text-[12px]">{d.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select> : d.roles.find((r) => r.id === m.role)?.label}</span>
            <span className="flex min-w-0 gap-1 overflow-hidden" title={m.walls.join(", ")}>{m.walls.length ? m.walls.map((w) => <span key={w} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-2 text-[11px] leading-[18px] text-zinc-600">{w}</span>) : <span className="text-[11.5px] text-zinc-400">No walls</span>}</span>
            <span className="text-right">{m.status === "active" ? <span className="text-[11.5px] text-zinc-500">Active</span> : <Pill tone="warn">Invited</Pill>}</span>
          </div>
        ))}
      </Rise>
      <Rise i={2} className="card mt-4 overflow-hidden">
        <div className="flex h-14 items-center border-b border-zinc-100 px-5"><div className="text-[14px] font-semibold" title="People outside a wall see the code name only. Crossing a wall needs the approver.">Wall groups</div>{d.isAdmin && <span className="ml-auto"><IconBtn icon={<Plus />} label="New wall" size="sm" onClick={p.onNewWall} /></span>}</div>
        {d.wallGroups.map((w) => (
          <div key={w.id} className="group/wall grid h-12 grid-cols-[minmax(0,1.4fr)_90px_minmax(0,1.2fr)_28px] items-center gap-4 border-b border-zinc-100 px-5 text-[12.5px] last:border-0">
            <span className="flex items-center gap-2 font-medium">{w.codename}{w.restricted && <WallBadge inside size="xs" />}</span>
            <span className="tnum text-right text-zinc-500">{w.members} people</span>
            <span className="truncate text-zinc-500">Approver · <span className="text-ink">{w.approver}</span></span>
            <IconBtn icon={<Settings2 />} label="Manage wall" size="sm" tone="bare" className="opacity-60 group-hover/wall:opacity-100" onClick={() => p.onManageWall?.(w.id)} />
          </div>
        ))}
      </Rise>
    </>
  );
}
function RolesAside({ d }: { d: SettingsData }) {
  return (
    <>
      <div className="eyebrow">Roles</div>
      <div className="mt-3 space-y-2">{d.roles.map((r) => <div key={r.id} className="rounded-xl border border-zinc-200 px-3.5 py-2.5"><div className="text-[13px] font-medium">{r.label}</div><div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{r.summary}</div></div>)}</div>
      <div className="mt-5 flex items-start gap-2 rounded-xl bg-zinc-50 p-3.5 text-[12px] leading-snug text-zinc-600"><Lock className="mt-0.5 size-3.5 shrink-0" />Walls apply everywhere: pipeline, ⌘K, Ask, Slack and MCP. Denials are logged in Access audit.</div>
    </>
  );
}

/* ───────── Access audit (access_denied_log, admin only) ───────── */
function AccessSection(p: SettingsScreenProps) {
  const rows = p.data.audit;
  const [f, setF] = useState<AccessDeniedRow["surface"] | "all">("all");
  const shown = f === "all" ? rows : rows.filter((r) => r.surface === f);
  const surfaces = Array.from(new Set(rows.map((r) => r.surface)));
  return (
    <>
      <div className="flex items-end justify-between">
        <div><h1 className="serif text-[32px] leading-none">Access audit</h1><div className="mt-2 text-[13px] text-zinc-500"><span className="tnum">{rows.length}</span> denied in this period</div></div>
        <IconBtn icon={<Download />} label="Export CSV" onClick={p.onExportAudit} />
      </div>
      <div className="mt-5 flex items-center gap-1.5">{(["all", ...surfaces] as const).map((s) => <Chip key={s} on={f === s} onClick={() => setF(s)}>{s === "all" ? "All" : SURFACE[s]}</Chip>)}</div>
      {shown.length ? (
        <Rise i={1} className="card mt-4 overflow-hidden">
          <div className="grid h-9 grid-cols-[92px_minmax(0,1fr)_minmax(0,1.3fr)_80px_minmax(0,1.6fr)] items-center gap-3 border-b border-zinc-100 bg-zinc-50/70 px-5 text-[11.5px] font-medium text-zinc-500"><span>When</span><span>Who</span><span>Tried to open</span><span>Where</span><span>Why denied</span></div>
          {shown.map((r) => (
            <div key={r.id} className="grid h-12 grid-cols-[92px_minmax(0,1fr)_minmax(0,1.3fr)_80px_minmax(0,1.6fr)] items-center gap-3 border-b border-zinc-100 px-5 text-[12.5px] last:border-0">
              <span className="tnum text-[11.5px] text-zinc-500">{r.at}</span>
              <span className="truncate font-medium">{r.who}</span>
              <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{r.target}</span><WallBadge iconOnly /></span>
              <span><Pill dot={false}>{SURFACE[r.surface]}</Pill></span>
              <span className="truncate text-zinc-600" title={r.reason}>{r.reason}</span>
            </div>
          ))}
        </Rise>
      ) : <EmptyState title="No denials" body="Nobody has been refused access in this period." />}
    </>
  );
}
function AccessAside() {
  return (
    <>
      <div className="eyebrow">What gets logged</div>
      <ul className="mt-3 space-y-2.5 text-[12.5px] leading-snug text-zinc-600">
        <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-ok" />Every refused open, search hit, Ask answer or Slack lookup on a walled deal</li>
        <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-ok" />Who asked, from where, and the code name they saw</li>
        <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0" />The person who was denied sees a private note. Nobody else is told.</li>
      </ul>
      <div className="mt-5 rounded-xl bg-zinc-50 p-3.5 text-[12px] text-zinc-600">Kept for compliance per your firm’s retention policy. Read-only. Rows can’t be edited or deleted.</div>
    </>
  );
}

/* ───────── Export + BYO LLM keys ───────── */
function ExportSection(p: SettingsScreenProps) {
  const e = p.data.export;
  const [bundle, setBundle] = useState<{ s: "idle" | "working" | "ready" | "failed"; url?: string; size?: string }>({ s: "idle" });
  const [keys, setKeys] = useState(e.keys);
  const [draft, setDraft] = useState<{ id: string; value: string } | null>(null);
  const run = async () => { setBundle({ s: "working" }); try { const r = await p.onExportBundle?.(); setBundle(r ? { s: "ready", ...r } : { s: "idle" }); } catch { setBundle({ s: "failed" }); } };
  const save = async () => {
    if (!draft || !draft.value.trim()) return;
    const k = keys.find((x) => x.id === draft.id); if (!k) return;
    const raw = draft.value; setDraft(null); // raw key leaves component state immediately
    try { const r = await p.onSaveKey?.(k.provider, raw); setKeys(keys.map((x) => x.id === k.id ? { ...x, masked: r?.masked ?? "••••", addedAt: "just now" } : x)); } catch { /* keep previous */ }
  };
  return (
    <>
      <h1 className="serif text-[32px] leading-none" title="Your firm’s data is yours. Take all of it, any time.">Export & keys</h1>
      <div className="mt-6 space-y-4">
        <Card title="Firm bundle" sub="Zip of Markdown, JSON and original files. Walled deals are included only if you are on the wall." meta={e.lastExport ? `Last downloaded ${e.lastExport}` : "Never downloaded"} right={
          <AnimatePresence mode="wait" initial={false}>
            {bundle.s === "ready" ? <motion.a key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} href={bundle.url} className="flex items-center gap-1.5 text-[12.5px] font-medium text-ok"><Check className="size-3.5" />Ready · {bundle.size} · Download</motion.a>
              : <motion.span key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Btn variant="primary" disabled={bundle.s === "working"} onClick={run} icon={bundle.s === "working" ? <Loader2 className="size-3.5 motion-safe:animate-spin" /> : <Download className="size-3.5" />}>{bundle.s === "working" ? "Preparing…" : "Download firm bundle"}</Btn></motion.span>}
          </AnimatePresence>
        }>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px]">{e.contents.map((c) => <div key={c} className="flex items-center gap-2 text-zinc-600"><Check className="size-3.5 text-zinc-400" />{c}</div>)}</div>
          {bundle.s === "failed" && <div role="alert" className="mt-3 text-[12px] text-rust">Export failed. Nothing was shared. Try again.</div>}
        </Card>
        <Card i={2} title="Your own model keys" sub="Optional. Deal Desk uses your keys for every agent run. Keys are encrypted and never shown again.">
          <div className="-mx-5 -mb-5 border-t border-zinc-100">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 text-[12.5px] last:border-0">
                <KeyRound className="size-4 text-zinc-400" /><span className="w-[110px] font-medium">{k.provider}</span>
                {draft?.id === k.id ? (
                  <form className="flex flex-1 items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); save(); }}>
                    <input autoFocus type="password" autoComplete="off" spellCheck={false} aria-label={`${k.provider} API key`} placeholder="Paste key" value={draft.value} onChange={(ev) => setDraft({ id: k.id, value: ev.target.value })} className="h-8 flex-1 rounded-lg border border-zinc-200 px-2.5 font-mono text-[12px] outline-none focus:border-ink" />
                    <Btn variant="primary" type="submit">Save key</Btn><Undo label="Cancel" onClick={() => setDraft(null)} />
                  </form>
                ) : k.masked ? (
                  <><span className="font-mono text-[12px] text-zinc-600">{k.masked}</span><span className="text-[11px] text-zinc-400">added {k.addedAt}</span><span className="ml-auto flex items-center gap-3"><button type="button" onClick={() => setDraft({ id: k.id, value: "" })} className="text-[12px] font-medium text-zinc-600 hover:text-ink">Replace</button><button type="button" onClick={() => { setKeys(keys.map((x) => x.id === k.id ? { ...x, masked: null } : x)); p.onRemoveKey?.(k.id); }} className="text-[12px] text-zinc-400 hover:text-rust">Remove</button></span></>
                ) : (
                  <><span className="text-zinc-400">Using Deal Desk’s models</span><button type="button" onClick={() => setDraft({ id: k.id, value: "" })} className="ml-auto text-[12px] font-medium text-zinc-600 hover:text-ink">Add key</button></>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
function ExportAside({ d }: { d: SettingsData }) {
  return (
    <>
      <div className="eyebrow">Where your data goes</div>
      <div className="mt-3 space-y-2.5 text-[12.5px] leading-snug text-zinc-600">
        <div className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0" />Bundles are built on request; download links expire.</div>
        <div className="flex gap-2"><KeyRound className="mt-0.5 size-3.5 shrink-0" />With your own keys, prompts go straight to your provider under your contract.</div>
      </div>
      <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4"><div className="flex items-center gap-2 text-[13px] font-medium"><Plug className="size-4" />MCP access</div><div className="mt-2 font-mono text-[11px] text-zinc-500">{d.mcp.url}</div></div>
    </>
  );
}

/* ───────── Briefs + guardrails (workflow / integrations aside) ───────── */
function BriefsAside(p: SettingsScreenProps) {
  const d = p.data;
  return (
    <>
      <div className="eyebrow">Briefs</div>
      <div className="mt-3 space-y-2">{d.briefs.map((b) => <div key={b.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-3 text-[13px]"><span className="font-medium">{b.label}</span><span className="tnum text-zinc-500">{b.time}</span><span className="ml-auto flex gap-1.5 text-zinc-500">{b.channels.includes("email") && <Mail className="size-4" />}{(b.channels.includes("slack") || b.channels.includes("teams")) && <MessageSquare className="size-4" />}</span><Toggle on={b.on} label={`${b.label} brief`} onChange={(v) => p.onToggleBrief?.(b.id, v)} /></div>)}</div>
      <div className="mt-6 eyebrow">Guardrails</div>
      <div className="mt-3 space-y-2.5 text-[13px]">{d.guardrails.map((g) => <div key={g.id} className="flex items-center gap-2"><Lock className={cx("size-3.5", g.on ? "text-ink" : "text-zinc-300")} />{g.label}<span className="ml-auto"><Toggle on={g.on} label={g.label} onChange={(v) => p.onToggleGuardrail?.(g.id, v)} /></span></div>)}</div>
    </>
  );
}
